"use server";

/**
 * Server actions for the invoice sidebar on the project page.
 *
 * These modify `payment_schedules` columns added in migration 036 —
 * online payment method toggles (card / ACH / partial), client-view
 * display toggles (quantities, unit price, totals, balance, late
 * stamp), signature requirement, and the manual "Mark as sent" flag.
 *
 * All actions write an activity-log row so Ronnie can see who flipped
 * what in the client's audit trail.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type SidebarResult = { ok: true } | { ok: false; error: string };

const ALLOWED_KEYS = [
  "allow_card",
  "allow_ach",
  "allow_partial",
  "show_quantities",
  "show_unit_price",
  "show_line_totals",
  "show_account_balance",
  "show_late_stamp",
  "require_signature",
] as const;

export type InvoiceSidebarKey = (typeof ALLOWED_KEYS)[number];

/**
 * Toggle one boolean column on the project's payment_schedule.
 * Called from the per-toggle checkbox in `<InvoiceSidebar>`.
 */
export async function setScheduleFlagAction(
  projectId: string,
  key: InvoiceSidebarKey,
  value: boolean,
): Promise<SidebarResult> {
  try {
    await requireRole(["admin", "office"]);
    if (!ALLOWED_KEYS.includes(key)) {
      return { ok: false, error: "Unknown flag." };
    }
    const supabase = createServiceRoleClient();
    const { data: sched } = await supabase
      .from("payment_schedules")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!sched) {
      return {
        ok: false,
        error:
          "This project doesn't have a payment schedule yet. Generate one first.",
      };
    }
    const { error } = await supabase
      .from("payment_schedules")
      .update({ [key]: value })
      .eq("id", sched.id);
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "invoice_setting_changed",
      payload: { key, value },
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/**
 * Manually mark the schedule as "sent" (Jobber's "Mark as sent"
 * pattern). Ronnie hits this when the invoice was delivered outside
 * the app — printed + mailed, PDF forwarded, etc. Sets `sent_at`
 * + `sent_by` + `sent_channel`.
 */
export async function markScheduleSentAction(
  projectId: string,
  channel: "manual" | "email" | "sms" | "print" = "manual",
): Promise<SidebarResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { data: sched } = await supabase
      .from("payment_schedules")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!sched) {
      return { ok: false, error: "No payment schedule on this project." };
    }
    const { error } = await supabase
      .from("payment_schedules")
      .update({
        sent_at: new Date().toISOString(),
        sent_by: user.id,
        sent_channel: channel,
      })
      .eq("id", sched.id);
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "invoice_marked_sent",
      payload: { channel, by: user.id },
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/** Undo "Mark as sent" — clears sent_at + sent_by + sent_channel. */
export async function unmarkScheduleSentAction(
  projectId: string,
): Promise<SidebarResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { data: sched } = await supabase
      .from("payment_schedules")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!sched) return { ok: false, error: "No schedule." };
    const { error } = await supabase
      .from("payment_schedules")
      .update({ sent_at: null, sent_by: null, sent_channel: null })
      .eq("id", sched.id);
    if (error) return { ok: false, error: error.message };
    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "invoice_sent_undone",
      payload: {},
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
