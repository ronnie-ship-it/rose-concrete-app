"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  computeForMethod,
  feeConfigFromRow,
  type FeeConfig,
  type PaymentMethod,
} from "@/lib/payments";

/**
 * Public action: the client on the pay page picks check vs credit card and
 * we write the selection (plus the computed fee) back to the milestone row.
 * Authorized solely by possession of the `pay_token` — no session required.
 *
 * The app never moves money. Writing payment_method + fee_amount +
 * total_with_fee is purely bookkeeping so the QBO invoice can be generated
 * with the right amount downstream.
 */

type Result = { ok: true } | { ok: false; error: string };

export async function selectPaymentMethod(
  token: string,
  method: PaymentMethod,
): Promise<Result> {
  if (!token) return { ok: false, error: "Missing token." };
  if (method !== "check" && method !== "ach" && method !== "credit_card") {
    return { ok: false, error: "Invalid payment method." };
  }

  const supabase = createServiceRoleClient();

  // Look up the milestone to get the amount and confirm the token is valid.
  const { data: milestone, error: fetchErr } = await supabase
    .from("payment_milestones")
    .select("id, amount, status")
    .eq("pay_token", token)
    .single();

  if (fetchErr || !milestone) {
    return { ok: false, error: "This pay link is no longer valid." };
  }
  if (milestone.status === "paid") {
    return { ok: false, error: "This milestone is already paid." };
  }

  // Load fee config (singleton); fall back to defaults if unset.
  const { data: settings } = await supabase
    .from("invoice_settings")
    .select(
      "cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, ach_fee_percent, ach_fee_flat_cents, ach_fee_absorb",
    )
    .limit(1)
    .maybeSingle();

  const feeConfig: FeeConfig = feeConfigFromRow(settings);
  const amount = Number(milestone.amount);
  const { fee, total } = computeForMethod(method, amount, feeConfig);

  const { error: updateErr } = await supabase
    .from("payment_milestones")
    .update({
      payment_method: method,
      fee_amount: fee,
      total_with_fee: total,
    })
    .eq("id", milestone.id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }
  return { ok: true };
}

/**
 * Captures a signature for either the milestone or the schedule that
 * owns it. Public action — token is the only credential. Stores the
 * PNG data URL in the signatures table. `scope="milestone"` is the
 * default — use it for per-milestone signature-on-payment (Jobber's
 * normal pattern); `scope="schedule"` covers invoice-level sign-on-
 * acceptance flows.
 *
 * Does NOT gate payment — the UI calls this alongside selectPaymentMethod
 * when `require_signature` is on. The back-end just records it.
 */
export async function submitPaymentSignatureAction(
  token: string,
  signerName: string,
  pngDataUrl: string,
  scope: "milestone" | "schedule" = "milestone",
): Promise<Result> {
  if (!token) return { ok: false, error: "Missing token." };
  const trimmedName = signerName.trim();
  if (!trimmedName) return { ok: false, error: "Please type your full name." };
  if (!pngDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Please draw your signature before submitting." };
  }
  // Rough size cap — a 160px canvas at 2x DPR comes in under 100 KB; a
  // 500 KB data URL probably means someone pasted an image.
  if (pngDataUrl.length > 500_000) {
    return { ok: false, error: "Signature image too large. Clear and retry." };
  }

  const supabase = createServiceRoleClient();
  const { data: milestone } = await supabase
    .from("payment_milestones")
    .select("id, schedule:payment_schedules!inner(id)")
    .eq("pay_token", token)
    .single();
  if (!milestone) {
    return { ok: false, error: "This pay link is no longer valid." };
  }
  const sched = Array.isArray(milestone.schedule)
    ? milestone.schedule[0]
    : milestone.schedule;
  if (!sched?.id) return { ok: false, error: "Schedule not found." };

  const entityType =
    scope === "schedule" ? "payment_schedule" : "payment_milestone";
  const entityId = scope === "schedule" ? sched.id : milestone.id;

  const h = await headers();
  const { error } = await supabase.from("signatures").insert({
    entity_type: entityType,
    entity_id: entityId,
    signer_name: trimmedName,
    png_data_url: pngDataUrl,
    captured_ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null,
    captured_user_agent: h.get("user-agent") ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
