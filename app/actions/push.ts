"use server";

/**
 * Server actions for managing the current user's Web Push subscription.
 *
 * `subscribePushAction` upserts the browser-provided PushSubscription
 * payload; `unsubscribePushAction` tears it down by endpoint.
 */
import { createClient } from "@/lib/supabase/server";

export async function subscribePushAction(payload: {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: payload.endpoint,
        p256dh: payload.p256dh,
        auth: payload.auth,
        user_agent: payload.user_agent ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unsubscribePushAction(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
