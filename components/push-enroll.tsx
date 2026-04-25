"use client";

/**
 * Push enrollment widget — currently DISABLED.
 *
 * Push notifications require an active service worker, but we removed
 * the SW from this app on 2026-04-25 because aggressive caching was
 * leaving users on stale builds. Until we ship a more conservative SW
 * (or pivot to native iOS/Android push), this widget renders a quick
 * "temporarily unavailable" notice instead of trying to subscribe.
 *
 * To re-enable later: restore `public/sw.js`, restore the registration
 * + subscribe code below, and revert the simplified return.
 */
import { useEffect } from "react";

export function PushEnroll() {
  // Best-effort: if a previous build registered a SW + push subscription
  // on this device, unsubscribe + unregister so we don't leave a stale
  // subscription that the (now-deleted) SW would never deliver to.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch {
            // ignore
          }
          await reg.unregister();
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">
        Push notifications
      </h3>
      <p className="mt-1 text-xs text-neutral-600">
        Push notifications are temporarily unavailable while we work on a
        more reliable delivery path. We&apos;ll send the same alerts via
        email and SMS in the meantime.
      </p>
    </div>
  );
}
