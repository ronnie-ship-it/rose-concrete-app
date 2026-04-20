"use client";

import { useTransition, useState } from "react";
import { textBookingConfirmationAction } from "../actions";

export function BookingTextButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function go() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await textBookingConfirmationAction(projectId);
      if (res.ok) {
        setMsg(res.message);
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={go}
        className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "📱 Text booking confirmation"}
      </button>
      {msg && <p className="text-[11px] text-emerald-700">{msg}</p>}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
