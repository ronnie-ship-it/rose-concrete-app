/**
 * Shared lead-intake pipeline.
 *
 * Every path that creates a lead — public webhook, /book form, OpenPhone
 * unknown-number call, Thumbtack / Poptin relay, etc. — funnels through
 * `createLead()` so the side-effects are identical:
 *
 *   1. Idempotency check on (source, external_id) or (phone, source,
 *      1-hour window) — prevents double-submits from re-firing every
 *      downstream effect.
 *   2. Client resolved by phone, then email. Creates a stub client if
 *      neither matches.
 *   3. Project row in status=lead + draft quote stub so Ronnie opens
 *      the app and sees a half-built quote already.
 *   4. `leads` row — the audit trail, source of truth for reports.
 *   5. Follow-up task on Ronnie's queue.
 *   6. In-app notification to every admin/office user.
 *   7. Activity log entry.
 *   8. Instant-response SMS via OpenPhone + email via Resend (best effort,
 *      never blocks the response).
 *
 * Returns a rich result so the caller can render confirmation copy (the
 * /book page says "check your texts" only when SMS actually fired).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";
import { getEmailAdapter } from "@/lib/email";
import { isServiceType, serviceLabel, type ServiceType } from "@/lib/service-types";

export type LeadIntake = {
  /** Lead source — 'web_webhook', 'online_booking', 'openphone_inbound', etc. */
  source: string;
  /** Optional dedupe key from the sending system. */
  external_id?: string | null;

  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;

  service_type?: string | null;
  message?: string | null;
  title?: string | null;
  requested_price?: number | null;

  /** Whole original payload for audit. */
  raw_payload?: Record<string, unknown>;
};

export type LeadResult =
  | { ok: true; duplicate: true; lead_id: string }
  | {
      ok: true;
      duplicate: false;
      lead_id: string;
      client_id: string;
      project_id: string;
      quote_id: string | null;
      responded: {
        /** Auto-text from Ronnie's number to the lead. */
        sms: boolean;
        /** Customer-facing confirmation email. */
        email: boolean;
        /** Internal notification email to LEAD_NOTIFICATION_EMAIL. */
        owner_email: boolean;
      };
    }
  | { ok: false; error: string };

/** Tiny HTML escape — only used for the owner-notification email body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nextQuoteNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${y}-${m}${day}-${rand}`;
}

export async function createLead(
  intake: LeadIntake,
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<LeadResult> {
  const name = (intake.name ?? "").trim() || null;
  const phone = normalizePhone(intake.phone);
  const email = (intake.email ?? "").trim().toLowerCase() || null;

  if (!name && !phone && !email) {
    return {
      ok: false,
      error: "Need at least one of name, phone, email.",
    };
  }

  const source = (intake.source ?? "").trim().slice(0, 64) || "unknown";
  const serviceType = isServiceType(intake.service_type)
    ? (intake.service_type as ServiceType)
    : null;

  // 1. Idempotency — external_id wins; fallback is (source, phone, last 1h).
  if (intake.external_id) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("source", source)
      .eq("external_id", intake.external_id)
      .maybeSingle();
    if (existing) {
      return { ok: true, duplicate: true, lead_id: existing.id as string };
    }
  }
  if (!intake.external_id && phone) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("leads")
      .select("id, client:clients(phone)")
      .eq("source", source)
      .gte("captured_at", oneHourAgo)
      .limit(5);
    const dup = ((existing ?? []) as Array<{
      id: string;
      client: { phone: string | null } | { phone: string | null }[] | null;
    }>).find((row) => {
      const c = Array.isArray(row.client) ? row.client[0] : row.client;
      return c?.phone === phone;
    });
    if (dup) {
      return { ok: true, duplicate: true, lead_id: dup.id };
    }
  }

  // 2. Client resolution.
  let clientId: string | null = null;
  if (phone) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (data) clientId = data.id;
  }
  if (!clientId && email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (data) clientId = data.id;
  }
  if (!clientId) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: name ?? email ?? phone ?? "New lead",
        phone,
        email,
        address: intake.address ?? null,
        city: intake.city ?? null,
        state: intake.state ?? "CA",
        postal_code: intake.postal_code ?? null,
        source,
      })
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "client insert failed",
      };
    }
    clientId = data.id;
  }

  // 3. Project + draft quote.
  const projectLabel = serviceType
    ? `${serviceLabel(serviceType)}${intake.address ? ` · ${intake.address}` : ""}`
    : intake.address || `New lead — ${name ?? source}`;

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      name: projectLabel,
      location: intake.address ?? null,
      service_address: intake.address ?? null,
      status: "lead",
      service_type: serviceType,
    })
    .select("id")
    .single();
  if (projectErr || !project) {
    return {
      ok: false,
      error: projectErr?.message ?? "project insert failed",
    };
  }

  const { data: quote } = await supabase
    .from("quotes")
    .insert({
      project_id: project.id,
      number: nextQuoteNumber(),
      scope_markdown: intake.message
        ? `**From the intake (${source}):**\n\n${intake.message}`
        : "",
      status: "draft",
    })
    .select("id")
    .single();

  // 4. Lead row.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      source,
      external_id: intake.external_id ?? null,
      service_type: serviceType,
      message: intake.message ?? null,
      title: intake.title ?? null,
      contact_name: name,
      contact_phone: phone,
      contact_email: email,
      service_address: intake.address ?? null,
      requested_price: intake.requested_price ?? null,
      client_id: clientId,
      project_id: project.id,
      quote_id: quote?.id ?? null,
      raw_payload: intake.raw_payload ?? {
        name,
        phone,
        email,
        address: intake.address,
        service_type: serviceType,
        message: intake.message,
      },
      status: "new",
      captured_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (leadErr || !lead) {
    return { ok: false, error: leadErr?.message ?? "lead insert failed" };
  }

  // 5. Follow-up task. Title surfaces the source page so the task queue
  //    immediately shows where the lead came from — actionable intel for
  //    "is the marketing site producing real work or noise?".
  const isMarketing = source.startsWith("marketing/");
  const sourceShort = source.replace(/^marketing\//, "");
  const taskTitle = isMarketing
    ? `Follow up: ${name ?? phone ?? email ?? "new lead"} from ${sourceShort} — 1hr SLA`
    : `Call back ${name ?? phone ?? email ?? "new lead"}`;
  await supabase.from("tasks").insert({
    title: taskTitle,
    body:
      (serviceType ? `Service: ${serviceLabel(serviceType)}\n` : "") +
      (intake.address ? `Address: ${intake.address}\n` : "") +
      `Source: ${source}\n` +
      (intake.message ? `\nMessage:\n${intake.message}` : ""),
    status: "open",
    kanban_column: "todo",
    priority: "high",
    client_id: clientId,
    project_id: project.id,
    source: `lead:${source}`,
    source_id: lead.id,
    due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h SLA
  });

  // 6. In-app notification for admin + office. Marketing-sourced leads
  //    link directly to the client detail (faster context than the
  //    leads list); other sources keep the leads-list link.
  const { data: officers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "office"]);
  if (officers && officers.length > 0) {
    const notifTitle = isMarketing
      ? `New lead from /${sourceShort}: ${name ?? phone ?? email ?? "anonymous"}`
      : `New lead: ${name ?? phone ?? email ?? source}`;
    const notifBody = serviceType
      ? `${serviceLabel(serviceType)}${intake.address ? ` at ${intake.address}` : ""}`
      : intake.address ?? `via ${source}`;
    const notifLink = clientId
      ? `/dashboard/clients/${clientId}`
      : isMarketing
        ? `/dashboard/leads/website`
        : `/dashboard/leads`;
    // Route through lib/notify so the in-app row + a Web Push both
    // fire (push is a no-op when VAPID keys aren't configured).
    const { notifyUsers } = await import("@/lib/notify");
    await notifyUsers(
      {
        userIds: officers.map((o) => o.id as string),
        kind: "new_lead",
        title: notifTitle,
        body: notifBody,
        link: notifLink,
        entity_type: "client",
        entity_id: clientId,
        sticky: true, // new leads nag until Ronnie opens them
      },
      supabase,
    );
  }

  // 7. Activity log.
  await supabase.from("activity_log").insert({
    entity_type: "lead",
    entity_id: lead.id,
    action: "lead_captured",
    payload: {
      source,
      service_type: serviceType,
      has_phone: !!phone,
      has_email: !!email,
    },
  });

  // 8. Instant-response SMS + email — best effort, never block.
  //    All three sends run in parallel so a slow Resend round-trip doesn't
  //    delay the OpenPhone send (and vice-versa). Each is wrapped in its
  //    own try/catch so one failure can't poison the others.
  const firstName = (name ?? "").split(/\s+/)[0] || "there";
  const ownerEmail =
    process.env.LEAD_NOTIFICATION_EMAIL || "ronnie@sandiegoconcrete.ai";

  // Auto-text from Ronnie's published business line. Copy is fixed here
  // so every channel (marketing site, /book form, webhook) sounds the
  // same. The OpenPhone adapter pins to OPENPHONE_PHONE_NUMBER_ID so
  // this always comes from (619) 537-9408 regardless of which number
  // happens to be first on the account.
  const smsToLeadPromise: Promise<boolean> = phone
    ? (async () => {
        try {
          const adapter = getOpenPhoneAdapter();
          const res = await adapter.sendMessage(
            phone,
            // ~330 chars — bills as ~3 SMS segments per send. OpenPhone
            // concatenates on the recipient side, so the lead sees one
            // message. Mentions Roger (foreman) as fallback so urgent
            // calls still land somewhere when Ronnie is on a job site.
            `Hi ${firstName}, this is Ronnie with Rose Concrete. Got your ` +
              `request — I'll call as soon as I can. If you need to reach me ` +
              `sooner, my number is (619) 537-9408. If I'm tied up, feel ` +
              `free to call my foreman Roger at (858) 943-0758. We'll also ` +
              `have a few other questions to get you a quote — would you ` +
              `mind sharing some photos of the project?`,
          );
          if (!res.ok) {
            // Surface the OpenPhone error in the dev log so the next
            // regression doesn't require the /api/debug/openphone dance
            // to diagnose. Includes lead.id so logs join up with the DB.
            console.error(
              `[createLead] sms-to-lead failed (lead=${lead.id}, skip=${res.skip}):`,
              res.error,
            );
          }
          return res.ok;
        } catch (err) {
          console.error(
            `[createLead] sms-to-lead threw (lead=${lead.id}):`,
            err,
          );
          return false;
        }
      })()
    : Promise.resolve(false);

  // Customer email confirmation — only sends if the lead supplied one.
  // Kept short and brand-light; the real conversion happens on the call.
  const emailToLeadPromise: Promise<boolean> = email
    ? (async () => {
        try {
          const emailAdapter = getEmailAdapter();
          const res = await emailAdapter.send({
            to: email,
            subject: "Thanks — Rose Concrete got your quote request",
            text:
              `Hi ${firstName},\n\n` +
              `Thanks for reaching out to Rose Concrete. We got your request` +
              (intake.address ? ` for ${intake.address}` : "") +
              ` and Ronnie will call you within the hour.\n\n` +
              `If it's urgent, reply to this email or call (619) 537-9408.\n\n` +
              `— Rose Concrete\n` +
              `San Diego · CA License #1130763 · Veteran-Owned · Fully Insured`,
            tag: "instant_response",
          });
          return res.ok;
        } catch (err) {
          console.error("[createLead] email-to-lead failed", err);
          return false;
        }
      })()
    : Promise.resolve(false);

  // Owner notification — every lead, every time, regardless of which
  // contact fields the lead supplied. This is the email Ronnie reads
  // first thing in the morning and during the day to triage callbacks.
  // `replyTo` is set to the lead's email when present so a "reply" goes
  // straight to them, not back to leads@.
  const ownerEmailPromise: Promise<boolean> = (async () => {
    try {
      const emailAdapter = getEmailAdapter();
      const lines: string[] = [
        `New lead from the website.`,
        ``,
        `Name:    ${name ?? "—"}`,
        `Phone:   ${phone ?? "—"}`,
        `Email:   ${email ?? "—"}`,
        `Zip:     ${intake.postal_code ?? "—"}`,
        `Address: ${intake.address ?? "—"}`,
        `Service: ${serviceType ? serviceLabel(serviceType) : intake.service_type ?? "—"}`,
        `Source:  ${source}`,
        ``,
        `Message:`,
        intake.message ?? "(none)",
        ``,
        `———`,
        `Lead ID:    ${lead.id}`,
        `Client ID:  ${clientId}`,
        `Project ID: ${project.id}`,
      ];
      const text = lines.join("\n");
      const html =
        `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">` +
        `<h2 style="margin:0 0 12px">New lead from the website</h2>` +
        `<table cellpadding="4" style="border-collapse:collapse;font-size:14px">` +
        `<tr><td><b>Name</b></td><td>${escapeHtml(name ?? "—")}</td></tr>` +
        `<tr><td><b>Phone</b></td><td>${escapeHtml(phone ?? "—")}</td></tr>` +
        `<tr><td><b>Email</b></td><td>${escapeHtml(email ?? "—")}</td></tr>` +
        `<tr><td><b>Zip</b></td><td>${escapeHtml(intake.postal_code ?? "—")}</td></tr>` +
        `<tr><td><b>Address</b></td><td>${escapeHtml(intake.address ?? "—")}</td></tr>` +
        `<tr><td><b>Service</b></td><td>${escapeHtml(
          serviceType ? serviceLabel(serviceType) : intake.service_type ?? "—",
        )}</td></tr>` +
        `<tr><td><b>Source</b></td><td>${escapeHtml(source)}</td></tr>` +
        `</table>` +
        (intake.message
          ? `<p style="margin-top:16px"><b>Message</b><br>${escapeHtml(intake.message).replace(/\n/g, "<br>")}</p>`
          : "") +
        `<hr style="margin:16px 0;border:none;border-top:1px solid #ddd">` +
        `<p style="color:#666;font-size:12px">Lead ${lead.id}</p>` +
        `</div>`;
      const subjectBits = [
        `New lead`,
        name ? `· ${name}` : "",
        serviceType ? `· ${serviceLabel(serviceType)}` : "",
        ` (${source})`,
      ]
        .filter(Boolean)
        .join(" ");
      const res = await emailAdapter.send({
        to: ownerEmail,
        subject: subjectBits.trim(),
        text,
        html,
        replyTo: email ?? undefined,
        tag: "lead_notification",
      });
      return res.ok;
    } catch (err) {
      console.error("[createLead] owner-notification email failed", err);
      return false;
    }
  })();

  const [smsSent, emailSent, ownerEmailSent] = await Promise.all([
    smsToLeadPromise,
    emailToLeadPromise,
    ownerEmailPromise,
  ]);

  if (smsSent || emailSent) {
    await supabase
      .from("leads")
      .update({
        responded_at: new Date().toISOString(),
        status: "contacted",
      })
      .eq("id", lead.id);
  }

  // At this point the upsert path guarantees clientId is set — narrow for TS.
  if (!clientId) {
    return { ok: false, error: "client_id missing after upsert" };
  }
  return {
    ok: true,
    duplicate: false,
    lead_id: lead.id,
    client_id: clientId,
    project_id: project.id,
    quote_id: quote?.id ?? null,
    responded: {
      sms: smsSent,
      email: emailSent,
      owner_email: ownerEmailSent,
    },
  };
}
