"use server";

/**
 * Admin-side actions for sending the three customer forms:
 *   - sendDemoAckAction      — pre-demo video + disclaimer
 *   - sendPrePourAction      — mix/pattern/finish/color confirm
 *   - sendCompletionAction   — post-job satisfaction + signature
 *
 * Each action ensures the form row exists, then delivers the
 * `/forms/<token>` link to the customer via email (Resend) or SMS
 * (OpenPhone). We never throw raw DB errors to the caller —
 * everything returns ok / error.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  ensureCustomerForm,
  stampFormSent,
  type CustomerFormKind,
} from "@/lib/customer-forms";
import { getEmailAdapter } from "@/lib/email";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

export type SendFormResult = { ok: true; url: string } | { ok: false; error: string };

async function originFromHeaders(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL)
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "app.sandiegoconcrete.ai";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function sendFormLink(
  projectId: string,
  kind: CustomerFormKind,
  channel: "email" | "sms",
): Promise<SendFormResult> {
  await requireRole(["admin", "office"]);
  const supabase = createServiceRoleClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, service_address, location, client:clients(id, name, email, phone)",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  const client = Array.isArray(project.client) ? project.client[0] : project.client;
  if (!client) return { ok: false, error: "Project has no client." };

  // For demo_ack, pull the welcome video URL from business_profile.
  let videoUrl: string | null = null;
  if (kind === "demo_ack") {
    const { data: business } = await supabase
      .from("business_profile")
      .select("welcome_video_url")
      .limit(1)
      .maybeSingle();
    videoUrl = (business?.welcome_video_url as string | null) ?? null;
  }

  const form = await ensureCustomerForm(
    projectId,
    kind,
    { videoUrl },
    supabase,
  );
  const origin = await originFromHeaders();
  const url = `${origin}/forms/${form.token}`;

  if (channel === "email") {
    if (!client.email) {
      return {
        ok: false,
        error: "Client has no email on file. Use SMS instead.",
      };
    }
    const adapter = getEmailAdapter();
    if (!adapter.isConfigured()) {
      return {
        ok: false,
        error:
          "Email isn't configured (RESEND_API_KEY missing). Copy the form URL and send it manually.",
      };
    }
    const firstName = (client.name as string).split(/\s+/)[0] ?? "there";
    const subject = subjectFor(kind);
    const body = bodyFor(kind, firstName, url);
    const res = await adapter.send({
      to: client.email as string,
      subject,
      text: body,
      tag: `customer_form:${kind}`,
    });
    if (!res.ok) return { ok: false, error: res.error };
  } else {
    if (!client.phone) {
      return {
        ok: false,
        error: "Client has no phone on file. Use email instead.",
      };
    }
    const phone = normalizePhone(client.phone as string);
    if (!phone) return { ok: false, error: "Invalid phone number on client." };
    const adapter = getOpenPhoneAdapter();
    const firstName = (client.name as string).split(/\s+/)[0] ?? "there";
    const body = smsBodyFor(kind, firstName, url);
    const res = await adapter.sendMessage(phone, body);
    if (!res.ok) return { ok: false, error: res.error };
  }

  await stampFormSent(form.id, channel, supabase);
  await supabase.from("activity_log").insert({
    entity_type: "project",
    entity_id: projectId,
    action: `customer_form_sent_${kind}`,
    payload: { channel, url },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true, url };
}

function subjectFor(kind: CustomerFormKind): string {
  if (kind === "demo_ack")
    return "A quick watch + sign before we start — Rose Concrete";
  if (kind === "pre_pour")
    return "Confirm your pour details — Rose Concrete";
  if (kind === "completion")
    return "Sign off on your finished concrete — Rose Concrete";
  return "Rose Concrete — please confirm";
}

function bodyFor(kind: CustomerFormKind, firstName: string, url: string): string {
  if (kind === "demo_ack") {
    return `Hi ${firstName},

Thanks for choosing Rose Concrete. Before our crew starts demo, please take 2 minutes to watch the short video and acknowledge a few things that can happen during tear-out:

${url}

Once you've signed off we'll lock in the start date.

— Ronnie Rose
Rose Concrete · San Diego`;
  }
  if (kind === "pre_pour") {
    return `Hi ${firstName},

We're ordering concrete in the next 24 hours. Please open this form and confirm the mix, pattern, finish, color, and any special requests so we get it right the first time:

${url}

As soon as you sign we'll place the order.

— Ronnie Rose
Rose Concrete · San Diego`;
  }
  if (kind === "completion") {
    return `Hi ${firstName},

The crew has wrapped. Please walk the site, make sure everything looks good, and sign off here:

${url}

If there's anything that needs a second look, note it on the form and we'll take care of it.

— Ronnie Rose
Rose Concrete · San Diego`;
  }
  return `Hi ${firstName},\n\nPlease review and sign:\n\n${url}\n\n— Rose Concrete`;
}

function smsBodyFor(
  kind: CustomerFormKind,
  firstName: string,
  url: string,
): string {
  if (kind === "demo_ack") {
    return `Hi ${firstName} — Ronnie at Rose Concrete. Quick 2-minute video + acknowledgment before our crew starts demo: ${url}`;
  }
  if (kind === "pre_pour") {
    return `Hi ${firstName} — Ronnie here. Confirm your pour details so we can order concrete: ${url}`;
  }
  if (kind === "completion") {
    return `Hi ${firstName} — job's wrapped. Quick sign-off so we can wrap the books: ${url}`;
  }
  return `Hi ${firstName} — please review: ${url}`;
}

export async function sendDemoAckAction(
  projectId: string,
  channel: "email" | "sms" = "email",
): Promise<SendFormResult> {
  return sendFormLink(projectId, "demo_ack", channel);
}
export async function sendPrePourAction(
  projectId: string,
  channel: "email" | "sms" = "email",
): Promise<SendFormResult> {
  return sendFormLink(projectId, "pre_pour", channel);
}
export async function sendCompletionAction(
  projectId: string,
  channel: "email" | "sms" = "email",
): Promise<SendFormResult> {
  return sendFormLink(projectId, "completion", channel);
}
