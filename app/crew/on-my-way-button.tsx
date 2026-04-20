"use client";

import { useState, useTransition } from "react";
import { sendOnMyWayAction } from "@/app/dashboard/schedule/actions";
import { t } from "@/lib/i18n";
import type { LangPref } from "@/lib/preferences";

export function OnMyWayButton({
  visitId,
  lang = "en",
}: {
  visitId: string;
  lang?: LangPref;
}) {
  const [eta, setEta] = useState(20);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function send() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await sendOnMyWayAction(visitId, eta);
      if (!res) return;
      if (res.ok) setMsg(res.message);
      else setErr(res.error);
    });
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs">
      <span className="text-neutral-600">{t(lang, "On my way")} —</span>
      <input
        type="number"
        min={5}
        max={240}
        value={eta}
        onChange={(e) => setEta(Math.max(5, Math.min(240, Number(e.target.value) || 20)))}
        className="w-12 rounded border border-neutral-200 px-1 text-xs"
      />
      <span className="text-neutral-500">{t(lang, "min")}</span>
      <button
        type="button"
        disabled={pending}
        onClick={send}
        className="ml-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "Send"}
      </button>
      {msg && <span className="ml-1 text-[11px] text-emerald-700">{msg}</span>}
      {err && <span className="ml-1 text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
