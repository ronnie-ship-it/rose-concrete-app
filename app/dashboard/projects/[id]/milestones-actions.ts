"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Admin/office actions on a single payment milestone. Kept separate from
 * the project-level CRUD actions so the import surface stays focused.
 *
 * `markPaid` and `markUnpaid` are manual overrides for the case where
 * Ronnie got paid outside QBO (e.g. cash, Venmo) and wants the app's
 * bookkeeping to reflect it. Once QBO reconcile is wired up (BACKLOG #1
 * sub-task 4), that cron becomes the primary writer of `status`.
 */

export type Result = { ok: true } | { ok: false; error: string };

export async function markMilestonePaid(
  projectId: string,
  milestoneId: string
): Promise<Result> {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_milestones")
    .update({
      status: "paid",
      qbo_paid_at: new Date().toISOString(),
      receipt_pending: true, // flag for the receipt worker (BACKLOG #3)
    })
    .eq("id", milestoneId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

/**
 * Toggle the per-milestone reminder pause. When paused, the reminder cron
 * ignores this milestone entirely — still useful if Ronnie has a side
 * conversation going with the client and doesn't want the robot chiming
 * in. Unpausing leaves scheduled rows intact so the cadence resumes.
 */
export async function toggleMilestoneReminders(
  projectId: string,
  milestoneId: string,
  paused: boolean
): Promise<Result> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_milestones")
    .update({ reminders_paused: paused })
    .eq("id", milestoneId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

export async function markMilestoneUnpaid(
  projectId: string,
  milestoneId: string
): Promise<Result> {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_milestones")
    .update({
      status: "pending",
      qbo_paid_at: null,
      qbo_paid_amount: null,
      receipt_pending: false,
    })
    .eq("id", milestoneId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
