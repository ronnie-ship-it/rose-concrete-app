import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * BACKLOG #2 — Reminder scheduling.
 *
 * Default cadence per milestone:
 *   T-3  email   "heads up, payment due in 3 days"
 *   T+0  email   "due today"
 *   T+3  email   "3 days past due"
 *   T+3  sms     same message, via OpenPhone
 *   T+7  email   "a week overdue — please get in touch"
 *   T+7  sms     same via OpenPhone
 *
 * SMS is reserved for overdue (T+) intentionally — pre-due nags over SMS
 * feel aggressive, email is plenty. Overdue = phone wakes up.
 *
 * Rows are keyed by (milestone_id, channel, offset_days) — the UNIQUE
 * constraint in the migration makes seeding idempotent without us having
 * to check first.
 *
 * Requires due_date on the milestone — skipped for milestones with
 * due_date = null ("Due on completion"). Those get reminders scheduled
 * once Ronnie sets a date.
 */

export type ReminderRule = {
  offset_days: number;   // relative to milestone.due_date; negative = before
  channel: "email" | "sms";
};

export const DEFAULT_REMINDER_RULES: ReminderRule[] = [
  { offset_days: -3, channel: "email" },
  { offset_days:  0, channel: "email" },
  { offset_days:  3, channel: "email" },
  { offset_days:  3, channel: "sms" },
  { offset_days:  7, channel: "email" },
  { offset_days:  7, channel: "sms" },
];

/**
 * Compute a scheduled_for timestamp from a due_date (YYYY-MM-DD) + offset.
 * Sends fire at 9 AM Pacific — that's when contractors actually read email.
 * We store UTC; 9 AM PT = 17:00 UTC (ignoring DST — Vercel cron is UTC and
 * being off by an hour for half the year is fine for a payment reminder).
 */
export function computeScheduledFor(dueDate: string, offsetDays: number): string {
  const d = new Date(`${dueDate}T17:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

export async function seedRemindersForMilestone(
  milestoneId: string,
  dueDate: string | null,
  supabase?: SupabaseClient,
  rules: ReminderRule[] = DEFAULT_REMINDER_RULES
): Promise<
  | { ok: true; scheduled: number }
  | { ok: false; error: string }
> {
  if (!(await isFeatureEnabled("payment_reminders"))) {
    return { ok: true, scheduled: 0 };
  }
  if (!dueDate) return { ok: true, scheduled: 0 };

  const db = supabase ?? createServiceRoleClient();

  const rows = rules.map((r) => ({
    milestone_id: milestoneId,
    channel: r.channel,
    offset_days: r.offset_days,
    scheduled_for: computeScheduledFor(dueDate, r.offset_days),
    status: "scheduled" as const,
  }));

  // onConflict hits the unique (milestone_id, channel, offset_days) index —
  // re-running this is a no-op.
  const { error } = await db
    .from("payment_reminders")
    .upsert(rows, {
      onConflict: "milestone_id,channel,offset_days",
      ignoreDuplicates: true,
    });

  if (error) return { ok: false, error: error.message };
  return { ok: true, scheduled: rows.length };
}

/**
 * Seed reminders for every milestone in a schedule. Called after
 * `seedDefaultScheduleFromQuote` has inserted milestones.
 */
export async function seedRemindersForSchedule(
  scheduleId: string,
  supabase?: SupabaseClient
): Promise<{ ok: true; scheduled: number } | { ok: false; error: string }> {
  if (!(await isFeatureEnabled("payment_reminders"))) {
    return { ok: true, scheduled: 0 };
  }
  const db = supabase ?? createServiceRoleClient();

  const { data: milestones, error } = await db
    .from("payment_milestones")
    .select("id, due_date")
    .eq("schedule_id", scheduleId);

  if (error) return { ok: false, error: error.message };

  let scheduled = 0;
  for (const m of milestones ?? []) {
    const res = await seedRemindersForMilestone(
      m.id as string,
      (m.due_date as string | null) ?? null,
      db
    );
    if (res.ok) scheduled += res.scheduled;
  }
  return { ok: true, scheduled };
}
