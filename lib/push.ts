/**
 * Web Push send helper.
 *
 * Uses the `web-push` package to deliver VAPID-signed notifications.
 * When VAPID env vars aren't set, `sendPushToUser` logs-and-skips so
 * calls from automations / notifications don't throw in development
 * or while Ronnie generates keys.
 *
 * Required env to actually deliver:
 *   VAPID_PUBLIC_KEY     — ECDSA public key, base64url
 *   VAPID_PRIVATE_KEY    — paired private key, base64url
 *   VAPID_SUBJECT        — mailto:ronnie@sandiegoconcrete.ai
 *
 * Generate with `npx web-push generate-vapid-keys`. Also expose the
 * public key to the browser via NEXT_PUBLIC_VAPID_PUBLIC_KEY so
 * components/push-enroll can subscribe.
 */
import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidInitialized = false;
function ensureVapid(): boolean {
  if (vapidInitialized) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  vapidInitialized = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

/** Send a push notification to every subscription registered for a user. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ attempted: number; delivered: number; skipped: boolean }> {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  const subs = (rows ?? []) as PushSubscriptionRow[];
  if (subs.length === 0) {
    return { attempted: 0, delivered: 0, skipped: false };
  }
  if (!ensureVapid()) {
    console.info(
      `[push] ${subs.length} subscription(s) for ${userId} — skipped (no VAPID keys)`,
    );
    return { attempted: subs.length, delivered: 0, skipped: true };
  }
  const body = JSON.stringify(payload);
  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      delivered++;
      // Best-effort: stamp last_used_at. Fire-and-forget.
      supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", sub.id)
        .then(
          () => undefined,
          () => undefined,
        );
    } catch (err) {
      const status = (err as { statusCode?: number } | null)?.statusCode;
      // 404 / 410 = subscription is dead; prune so we don't keep hitting it.
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.warn("[push] send failed", err);
      }
    }
  }
  return { attempted: subs.length, delivered, skipped: false };
}
