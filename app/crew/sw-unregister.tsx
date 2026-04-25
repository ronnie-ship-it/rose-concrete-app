"use client";

/**
 * One-shot **unregistration** shim — NOT a service worker registrar.
 *
 * The crew app used to ship a service worker (`/public/sw.js`) that
 * cached HTML aggressively. Even after switching to network-first +
 * bumping the cache version, users on installed PWAs reported stuck
 * stale content. Diagnosis: the BROWSER itself was holding onto the
 * registered SW and not picking up the new bytes.
 *
 * Mitigation: ship a vanilla web app (no SW at all) and run this shim
 * exactly once per device to:
 *   1. Unregister every active service worker registered for our origin.
 *   2. Delete every Cache Storage cache the old SW created.
 *   3. Reload once so the now-fresh page replaces whatever stale HTML
 *      the SW was still controlling.
 *
 * The shim self-marks completion in `localStorage` so it doesn't loop.
 *
 * Once we're confident every device that ever installed the SW has
 * visited the app at least once after this lands, we can delete this
 * file entirely. ~2-3 weeks should be enough.
 */
import { useEffect } from "react";

const RAN_KEY = "rc:sw-cleanup-ran-v1";

export function ServiceWorkerUnregister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (localStorage.getItem(RAN_KEY) === "1") return;

    let didWork = false;

    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
          didWork = true;
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) {
            await caches.delete(k);
            didWork = true;
          }
        }
      } catch (err) {
        // If anything throws, mark done anyway — better to skip the
        // cleanup than to loop on a transient error.
        console.warn("[sw-unregister] cleanup error", err);
      } finally {
        localStorage.setItem(RAN_KEY, "1");
        // Reload only when we actually unregistered something. This
        // matters because reloading a page that wasn't SW-controlled
        // is wasteful, and could put us in a refresh loop if anything
        // weird happens during the cleanup.
        if (didWork) {
          window.location.reload();
        }
      }
    })();
  }, []);

  return null;
}
