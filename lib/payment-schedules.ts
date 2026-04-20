import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { seedRemindersForSchedule } from "@/lib/payment-reminders";
import type { PaymentMethod } from "@/lib/payments";

/**
 * BACKLOG #1 sub-task — when a project flips to `approved`, seed a default
 * payment schedule from the accepted quote:
 *   milestone 1: deposit (amount from quote.deposit_amount OR
 *                quote.deposit_percent × accepted_total), due today
 *   milestone 2: final balance (remainder), due_date = null ("on completion")
 *
 * Payment-method lock (migration 024): if the quote has
 * `locked_payment_method` set, each milestone is stamped with that method
 * and the fee is prorated across milestones so the per-milestone
 * `total_with_fee` values sum to `locked_total_charged`. That keeps the
 * QBO invoice, the pay-links, and the signed quote all internally
 * consistent — no way to drift by a rounding penny.
 *
 * Idempotent on two axes:
 *   - Schema: payment_schedules.project_id is UNIQUE — a second insert
 *     returns a duplicate-key error which we swallow.
 *   - Flag: no-op when feature flag `payment_schedules` is off.
 */
export async function seedDefaultScheduleFromQuote(
  projectId: string,
  supabase?: SupabaseClient,
): Promise<
  | { ok: true; created: boolean; scheduleId?: string }
  | { ok: false; error: string }
> {
  if (!(await isFeatureEnabled("payment_schedules"))) {
    return { ok: true, created: false };
  }

  const db = supabase ?? createServiceRoleClient();

  // Don't double-seed.
  const { data: existing } = await db
    .from("payment_schedules")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) return { ok: true, created: false, scheduleId: existing.id };

  // Pull the accepted (or most recent) quote for this project. Prefer
  // accepted_total when the client has already signed off; fall back to
  // base_total on draft quotes so a manual status flip still seeds something
  // sensible.
  const { data: quote, error: quoteErr } = await db
    .from("quotes")
    .select(
      "id, status, accepted_total, base_total, deposit_amount, deposit_percent, locked_payment_method, locked_base_total, locked_fee_amount, locked_total_charged",
    )
    .eq("project_id", projectId)
    .order("status", { ascending: false }) // 'accepted' sorts after 'draft'/'sent'
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quoteErr) return { ok: false, error: quoteErr.message };
  if (!quote) {
    return {
      ok: false,
      error: "No quote found for project; cannot seed schedule.",
    };
  }

  // Base total (no fees). Prefer the locked base if present.
  const total = Number(
    quote.locked_base_total ?? quote.accepted_total ?? quote.base_total ?? 0,
  );
  if (!(total > 0)) {
    return { ok: false, error: "Quote total is zero; cannot seed schedule." };
  }

  // Deposit resolution: explicit amount wins, else percent × total, else 50%.
  const depositFromAmount = quote.deposit_amount
    ? Number(quote.deposit_amount)
    : null;
  const depositPercent = Number(quote.deposit_percent ?? 50);
  const depositRaw = depositFromAmount ?? (total * depositPercent) / 100;
  // Clamp + round to cents so amounts always sum to the total exactly.
  const deposit = Math.min(total, Math.round(depositRaw * 100) / 100);
  const final = Math.round((total - deposit) * 100) / 100;

  // Locked payment state. Null when the schedule is being seeded manually
  // (pre-lock quotes, admin-driven flips). In that case every milestone's
  // payment_method / fee_amount stays unset and the client picks per
  // milestone on the old pay page.
  const lockedMethod =
    (quote.locked_payment_method as PaymentMethod | null | undefined) ?? null;
  const lockedFeeTotal = Number(quote.locked_fee_amount ?? 0);
  const lockedTotalCharged = Number(
    quote.locked_total_charged ?? total + lockedFeeTotal,
  );

  // Prorate the locked fee across the two milestones by ratio of base
  // amount; round the deposit fee and let the final absorb the rounding
  // remainder. Keeps the sum exact to the penny.
  const depositFee =
    lockedFeeTotal > 0
      ? Math.round((lockedFeeTotal * deposit) / total * 100) / 100
      : 0;
  const finalFee = lockedFeeTotal > 0
    ? Math.round((lockedFeeTotal - depositFee) * 100) / 100
    : 0;

  const { data: schedule, error: insErr } = await db
    .from("payment_schedules")
    .insert({
      project_id: projectId,
      total_amount: lockedMethod ? lockedTotalCharged : total,
      status: "active",
      notes: `Auto-seeded from quote ${quote.id} on project approval.${
        lockedMethod
          ? ` Locked method: ${lockedMethod}. Total with fee: ${lockedTotalCharged}.`
          : ""
      }`,
    })
    .select("id")
    .single();

  if (insErr) {
    // Unique constraint — someone else seeded between the select and insert.
    // Race is fine; return the row that won.
    if (insErr.code === "23505") {
      const { data: row } = await db
        .from("payment_schedules")
        .select("id")
        .eq("project_id", projectId)
        .single();
      return { ok: true, created: false, scheduleId: row?.id };
    }
    return { ok: false, error: insErr.message };
  }

  const today = new Date().toISOString().slice(0, 10);
  const depositTotalWithFee = Math.round((deposit + depositFee) * 100) / 100;
  const finalTotalWithFee = Math.round((final + finalFee) * 100) / 100;

  const milestones: Array<Record<string, unknown>> = [
    {
      schedule_id: schedule.id,
      sequence: 1,
      kind: "deposit",
      label: `${depositPercent}% deposit (non-refundable)`,
      amount: deposit,
      due_date: today,
      status: "due",
      payment_method: lockedMethod,
      fee_amount: depositFee,
      total_with_fee: lockedMethod ? depositTotalWithFee : null,
    },
    {
      schedule_id: schedule.id,
      sequence: 2,
      kind: "final",
      label: "Balance due on completion",
      amount: final,
      due_date: null,
      status: "pending",
      payment_method: lockedMethod,
      fee_amount: finalFee,
      total_with_fee: lockedMethod ? finalTotalWithFee : null,
    },
  ];

  const { error: msErr } = await db
    .from("payment_milestones")
    .insert(milestones);
  if (msErr) return { ok: false, error: msErr.message };

  // Seed reminder rows for each milestone. No-op if the reminders flag is
  // off — logic lives in seedRemindersForSchedule.
  await seedRemindersForSchedule(schedule.id, db).catch(() => {
    // Non-fatal: reminders are a layer on top of the schedule, not a
    // prerequisite. A cron retry will pick up any missing rows.
  });

  return { ok: true, created: true, scheduleId: schedule.id };
}
