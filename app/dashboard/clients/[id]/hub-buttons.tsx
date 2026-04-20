"use client";

/**
 * Two Jobber-parity client-hub controls on the client detail page:
 *
 *   "Send login email" — emails the client their /hub/<token> link.
 *   "Log in as client"  — opens the same link in a new tab so admin
 *                         sees exactly what the client sees.
 *
 * Both are thin wrappers around server actions; both log to
 * activity_log so there's a trail of who did what.
 */
import { useState, useTransition } from "react";
import {
  sendHubLoginEmailAction,
  getImpersonationHubUrlAction,
} from "./hub-actions";

export function ClientHubButtons({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function sendEmail() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await sendHubLoginEmailAction(clientId);
      if (res.ok) setMsg(res.message ?? "Sent.");
      else setErr(res.error);
    });
  }

  function impersonate() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await getImpersonationHubUrlAction(clientId);
      if (res.ok && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else if (!res.ok) {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={sendEmail}
        disabled={pending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        ✉ Send login email
      </button>
      <button
        type="button"
        onClick={impersonate}
        disabled={pending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        title="Open the client hub in a new tab to see exactly what this client sees"
      >
        👤 Log in as client
      </button>
      {msg && (
        <span className="text-xs font-semibold text-emerald-700">{msg}</span>
      )}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}
