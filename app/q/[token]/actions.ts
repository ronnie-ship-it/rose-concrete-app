"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { maybeSendDocusignEnvelopeForQuote } from "@/lib/docusign";
import { seedDefaultScheduleFromQuote } from "@/lib/payment-schedules";
import { autoInvoiceForApprovedQuote } from "@/lib/qbo/auto-invoice";
import { runAutomationsFor } from "@/lib/automations";
import {
  computeForMethod,
  feeConfigFromRow,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/payments";

const AcceptSchema = z.object({
  token: z.string().min(1),
  signature: z.string().trim().min(1, "Signature required").max(200),
  selected_optional_ids: z.string().optional(), // CSV from hidden input
  payment_method: z
    .enum(["check", "ach", "credit_card"])
    .refine((v): v is PaymentMethod => PAYMENT_METHODS.includes(v), {
      message: "Pick a payment method.",
    }),
});

export type AcceptState =
  | {
      ok: true;
      total: number;
      fee: number;
      total_charged: number;
      method: PaymentMethod;
    }
  | { ok: false; error: string }
  | null;

export async function acceptQuoteAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  // Surface the "didn't pick a method" case as a nice human error rather
  // than a Zod union mess.
  const methodRaw = String(formData.get("payment_method") ?? "").trim();
  if (!methodRaw) {
    return {
      ok: false,
      error: "Please choose a payment method above before signing.",
    };
  }

  const parsed = AcceptSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid submission.",
    };
  }

  const supabase = createServiceRoleClient();

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, status, project_id")
    .eq("public_token", parsed.data.token)
    .single();

  if (qErr || !quote) return { ok: false, error: "Quote not found." };
  if (quote.status === "accepted") {
    return {
      ok: false,
      error:
        "This quote has already been accepted. Payment method + total are locked.",
    };
  }

  // Resolve which optional items were checked, then recompute the accepted
  // total server-side. Never trust the client's value.
  const selectedIds = (parsed.data.selected_optional_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: items } = await supabase
    .from("quote_line_items")
    .select("id, quantity, unit_price, is_optional")
    .eq("quote_id", quote.id);

  let acceptedTotal = 0;
  for (const it of items ?? []) {
    const lineTotal = Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
    if (it.is_optional) {
      const chosen = selectedIds.includes(it.id);
      await supabase
        .from("quote_line_items")
        .update({ is_selected: chosen })
        .eq("id", it.id);
      if (chosen) acceptedTotal += lineTotal;
    } else {
      acceptedTotal += lineTotal;
    }
  }

  // Load fee config from invoice_settings + compute the locked totals
  // server-side. The client showed a preview; the server is the source of
  // truth. If rounding drifts for any reason the server's number wins.
  const { data: settings } = await supabase
    .from("invoice_settings")
    .select(
      "cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, ach_fee_percent, ach_fee_flat_cents, ach_fee_absorb",
    )
    .limit(1)
    .maybeSingle();
  const feeConfig = feeConfigFromRow(settings);
  const { fee: lockedFee, total: lockedTotalCharged } = computeForMethod(
    parsed.data.payment_method,
    acceptedTotal,
    feeConfig,
  );

  // Best-effort capture of client IP from headers.
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: nowIso,
      accepted_signature: parsed.data.signature,
      accepted_by_name: parsed.data.signature,
      accepted_ip: ip,
      accepted_total: acceptedTotal,
      locked_payment_method: parsed.data.payment_method,
      locked_base_total: acceptedTotal,
      locked_fee_amount: lockedFee,
      locked_total_charged: lockedTotalCharged,
      locked_at: nowIso,
    })
    .eq("id", quote.id);

  if (updErr) return { ok: false, error: updErr.message };

  // Move project from quoting/lead → approved.
  await supabase
    .from("projects")
    .update({ status: "approved" })
    .eq("id", quote.project_id);

  // Seed the default payment schedule from the LOCKED totals. Pro-rata the
  // fee across milestones so the sum of `total_with_fee` equals the locked
  // total_charged (and thus the QBO invoice).
  try {
    const seed = await seedDefaultScheduleFromQuote(quote.project_id, supabase);
    if (!seed.ok) {
      console.error("[accept] payment schedule seed failed:", seed.error);
    }
  } catch (err) {
    console.error("[accept] payment schedule seed threw:", err);
  }

  // Auto-create the QBO invoice for the locked total. No-op if the feature
  // flag is off or QBO creds aren't set — never blocks the accept flow.
  try {
    const auto = await autoInvoiceForApprovedQuote(
      quote.project_id,
      quote.id,
      supabase,
    );
    if (!auto.ok) {
      console.error("[accept] qbo auto-invoice failed:", auto.error);
    } else if ("skipped" in auto) {
      console.log("[accept] qbo auto-invoice skipped:", auto.skipped);
    } else {
      console.log(
        "[accept] qbo invoice created:",
        auto.qbo_invoice_number,
        auto.pay_now_url ? `pay_now_url=${auto.pay_now_url}` : "",
      );
    }
  } catch (err) {
    console.error("[accept] qbo auto-invoice threw:", err);
  }

  // Activity log.
  await supabase.from("activity_log").insert({
    entity_type: "quote",
    entity_id: quote.id,
    action: "quote_accepted",
    payload: {
      accepted_total: acceptedTotal,
      payment_method: parsed.data.payment_method,
      locked_fee_amount: lockedFee,
      locked_total_charged: lockedTotalCharged,
      ip,
    },
  });

  // User-configured automations — fires any rules tied to the
  // `quote_approved` trigger. Never throws; best-effort by design.
  try {
    // Pull client phone + email for the SMS/email action targets.
    const { data: project } = await supabase
      .from("projects")
      .select(
        "id, name, service_address, service_type, client:clients(id, name, phone, email)",
      )
      .eq("id", quote.project_id)
      .maybeSingle();
    type P = {
      id: string;
      name: string;
      service_address: string | null;
      service_type: string | null;
      client:
        | { id: string; name: string; phone: string | null; email: string | null }
        | { id: string; name: string; phone: string | null; email: string | null }[]
        | null;
    };
    const p = project as P | null;
    const c = p?.client
      ? Array.isArray(p.client)
        ? p.client[0]
        : p.client
      : null;
    await runAutomationsFor(
      {
        trigger: "quote_approved",
        entity_type: "quote",
        entity_id: quote.id,
        payload: {
          project_id: quote.project_id,
          client_id: c?.id ?? null,
          client_name: c?.name ?? null,
          client_phone: c?.phone ?? null,
          client_email: c?.email ?? null,
          project_name: p?.name ?? null,
          service_address: p?.service_address ?? null,
          service_type: p?.service_type ?? null,
          amount: acceptedTotal,
        },
      },
      supabase,
    );
  } catch (err) {
    console.error("[accept] automations dispatcher threw:", err);
  }

  // Fire-and-forget DocuSign envelope. Silently no-ops unless the feature
  // flag and DocuSign env vars are wired up (Phase 0 dependency).
  try {
    await maybeSendDocusignEnvelopeForQuote(quote.id);
  } catch (err) {
    console.error("[accept] docusign send failed", err);
  }

  // Seed the default task checklist for this project. Idempotent — duplicate
  // template titles are skipped.
  try {
    await seedTasksForQuote(quote.id, quote.project_id);
  } catch (err) {
    console.error("[accept] task seed failed", err);
  }

  revalidatePath(`/q/${parsed.data.token}`);
  revalidatePath(`/dashboard/quotes/${quote.id}`);
  revalidatePath("/dashboard/tasks");
  return {
    ok: true,
    total: acceptedTotal,
    fee: lockedFee,
    total_charged: lockedTotalCharged,
    method: parsed.data.payment_method,
  };
}

async function seedTasksForQuote(
  quoteId: string,
  projectId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: templates } = await supabase
    .from("task_templates")
    .select("id, title, body, days_after, priority, sort_order")
    .eq("is_active", true)
    .eq("trigger", "quote_approved")
    .order("sort_order");
  if (!templates || templates.length === 0) return;

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  const { data: existing } = await supabase
    .from("tasks")
    .select("title")
    .eq("project_id", projectId)
    .eq("source", "quote_approved_template");
  const already = new Set(
    (existing ?? []).map((r) => r.title.toLowerCase().trim()),
  );
  const now = Date.now();
  const rows = templates
    .filter((t) => !already.has(t.title.toLowerCase().trim()))
    .map((t) => ({
      title: t.title,
      body: t.body,
      project_id: projectId,
      client_id: project?.client_id ?? null,
      priority: t.priority,
      kanban_column: "todo",
      status: "open",
      source: "quote_approved_template",
      source_id: quoteId,
      due_at: new Date(
        now + (t.days_after ?? 0) * 24 * 60 * 60 * 1000,
      ).toISOString(),
      sort_order: t.sort_order ?? 0,
    }));
  if (rows.length > 0) {
    await supabase.from("tasks").insert(rows);
  }
}
