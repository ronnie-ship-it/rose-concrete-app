"use server";

/**
 * Send a test push notification to the current user — Ronnie hits
 * the "Send test" button on /dashboard/settings/notifications to
 * verify VAPID + the service worker are wired correctly.
 *
 * Returns the attempted / delivered counts so the UI can show
 * "2 delivered" (handy when the user has more than one browser
 * enrolled, e.g. phone + laptop).
 */
import { requireRole } from "@/lib/auth";
import { sendPushToUser, isPushConfigured } from "@/lib/push";

export type TestPushResult =
  | { ok: true; attempted: number; delivered: number }
  | { ok: false; error: string };

export async function sendTestPushAction(): Promise<TestPushResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    if (!isPushConfigured()) {
      return {
        ok: false,
        error:
          "VAPID env vars aren't set. Generate with `npx web-push generate-vapid-keys` and drop VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT into .env.local.",
      };
    }
    const res = await sendPushToUser(user.id, {
      title: "🧪 Test — Rose Concrete",
      body: "If you're seeing this, push notifications work on this device.",
      url: "/dashboard/settings/notifications",
      tag: "test",
    });
    if (res.attempted === 0) {
      return {
        ok: false,
        error:
          "You don't have any devices enrolled. Click Turn on above first.",
      };
    }
    return {
      ok: true,
      attempted: res.attempted,
      delivered: res.delivered,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
