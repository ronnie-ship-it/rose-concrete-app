"use client";

/**
 * "On my way" — full-width tap target that opens a small drawer with
 * three preset ETAs (15 / 30 / 45 min). Crew taps once to open, once
 * to pick an ETA. Sends an automatic SMS to the client via OpenPhone
 * ("Hi Jane, Alex is on the way, ETA 25 min"). The chip remains
 * expanded after send showing the "Sent ✓" confirmation.
 */
import { useState, useTransition } from "react";
import { sendOnMyWayAction } from "@/app/dashboard/schedule/actions";
import { t } from "@/lib/i18n";
import type { LangPref } from "@/lib/preferences";

const PRESET_ETAS = [15, 30, 45] as const;

export function OnMyWayButton({
  visitId,
  lang = "en",
}: {
  visitId: string;
  lang?: LangPref;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [sentEta, setSentEta] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function send(eta: number) {
    setErr(null);
    start(async () => {
      const res = await sendOnMyWayAction(visitId, eta);
      if (!res) return;
      if (res.ok) {
        setSentEta(eta);
        setOpen(false);
      } else {
        setErr(res.error);
      }
    });
  }

  if (sentEta != null) {
    return (
      <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-emerald-100 px-4 text-sm font-semibold text-emerald-900">
        <span className="text-lg">✓</span>
        <span>
          {t(lang, "On my way")} — {sentEta} {t(lang, "min")}
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-800 active:bg-neutral-50"
      >
        <span className="text-lg">🚗</span>
        <span>{t(lang, "On my way")}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
      <p className="mb-2 text-xs font-semibold text-brand-900">
        {t(lang, "On my way")} — {lang === "es" ? "Elige ETA" : "pick ETA"}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {PRESET_ETAS.map((eta) => (
          <button
            key={eta}
            type="button"
            disabled={pending}
            onClick={() => send(eta)}
            className="min-h-12 rounded-md bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
          >
            {eta} {t(lang, "min")}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 w-full text-center text-xs text-neutral-500 underline"
      >
        {lang === "es" ? "Cancelar" : "Cancel"}
      </button>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
