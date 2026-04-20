/**
 * Unified in-app + push notification helper.
 *
 * Call sites used to `supabase.from("notifications").insert(rows)`
 * directly and the user only got a badge in the bell menu. Now they
 * should call `notifyUsers()` instead — which writes the same row AND
 * fires a Web Push for each recipient (no-op when VAPID keys are
 * unset, see lib/push).
 *
 * Keeps the same row shape the existing <NotificationBell> reads, so
 * nothing downstream changes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

export type NotifyKind =
  | "new_lead"
  | "quote_approved"
  | "invoice_paid"
  | "job_completed"
  | "new_message"
  | "overdue_task"
  | "quote_follow_up"
  | "review_received"
  | "system";

export type NotifyInput = {
  userIds: string[];
  kind: NotifyKind;
  title: string;
  body?: string | null;
  link?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  /** When true, the matching push shows up with requireInteraction so
   *  it sticks until dismissed — use sparingly (overdue tasks, new
   *  leads). Default false. */
  sticky?: boolean;
};

export async function notifyUsers(
  input: NotifyInput,
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<{ inserted: number; pushed: number }> {
  const ids = Array.from(new Set(input.userIds)).filter(Boolean);
  if (ids.length === 0) return { inserted: 0, pushed: 0 };

  const rows = ids.map((uid) => ({
    user_id: uid,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.warn("[notify] insert failed", error);
    return { inserted: 0, pushed: 0 };
  }

  // Fire push in parallel. Best-effort — a failing push shouldn't
  // affect the in-app badge.
  const results = await Promise.all(
    ids.map((uid) =>
      sendPushToUser(uid, {
        title: input.title,
        body: input.body ?? undefined,
        url: input.link ?? undefined,
        tag: `${input.kind}:${input.entity_id ?? ""}`,
        requireInteraction: input.sticky === true,
      }).catch(() => ({ attempted: 0, delivered: 0, skipped: true })),
    ),
  );
  const pushed = results.reduce((s, r) => s + r.delivered, 0);
  return { inserted: rows.length, pushed };
}
