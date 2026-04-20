"use client";

/**
 * "Send test push" button on the notifications settings page. Lets
 * Ronnie verify the VAPID keys + service worker are wired by sending
 * a real push to every browser he's enrolled, and reports the
 * delivered count.
 */
import { useState, useTransition } from "react";
import { sendTestPushAction } from "./actions";

export function TestPushButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function send() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await sendTestPushAction();
      if (res.ok) {
        setMsg(
          `Delivered to ${res.delivered} of ${res.attempted} device${
            res.attempted === 1 ? "" : "s"
          }.`,
        );
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
      >
        {pending ? "Sending…" : "Send test push"}
      </button>
      {msg && <span className="text-xs text-emerald-700">{msg}</span>}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
