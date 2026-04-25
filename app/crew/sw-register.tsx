"use client";

/**
 * Register the /sw.js service worker on the crew app. Mount this
 * once (from app/crew/layout.tsx) — it runs in a useEffect so the
 * registration is async and non-blocking. If registration fails
 * we silently swallow the error; the app still works online, just
 * without offline caching or push.
 *
 * Update flow: when a new sw.js is detected (different bytes), the
 * browser fires `controllerchange` after the new SW takes over via
 * skipWaiting + clients.claim(). We listen for that event and reload
 * the page once — that way every deploy lands on the user's phone
 * the first time they open the app, no manual refresh needed.
 */
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Reload exactly once when a new SW takes control. Without this,
    // the cache-version bump only takes effect on the SECOND open.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    const go = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          // Poll for SW updates every 60s while the tab is open. If a
          // deploy lands while the crew member has the app open, this
          // catches it without forcing them to background + reopen.
          const interval = setInterval(() => {
            reg.update().catch(() => undefined);
          }, 60_000);
          // Tab going to bg/fg also triggers an update check.
          window.addEventListener("focus", () => {
            reg.update().catch(() => undefined);
          });
          return () => clearInterval(interval);
        })
        .catch((err) => console.warn("[sw] register failed", err));
    };

    if ("requestIdleCallback" in window) {
      (
        window as Window & {
          requestIdleCallback: (cb: () => void) => void;
        }
      ).requestIdleCallback(go);
    } else {
      setTimeout(go, 1000);
    }
  }, []);
  return null;
}
