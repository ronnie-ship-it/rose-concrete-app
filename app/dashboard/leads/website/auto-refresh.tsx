"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the parent server component every N seconds via router.refresh().
 *
 * Cheap "real-time-ish" for dashboards that don't justify a websocket
 * channel. The server component re-runs and sends a fresh RSC payload;
 * the page hydrates without a full reload.
 *
 * Pauses when the tab is hidden so we don't burn requests for an
 * inactive tab.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, intervalMs);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    });
    return () => stop();
  }, [router, intervalMs]);

  return null;
}
