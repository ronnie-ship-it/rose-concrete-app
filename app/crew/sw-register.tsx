"use client";

/**
 * Register the /sw.js service worker on the crew app. Mount this
 * once (from app/crew/layout.tsx) — it runs in a useEffect so the
 * registration is async and non-blocking. If registration fails
 * we silently swallow the error; the app still works online, just
 * without offline caching or push.
 */
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register once the window is idle so we don't compete with
    // the initial render for bandwidth/CPU.
    const go = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
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
