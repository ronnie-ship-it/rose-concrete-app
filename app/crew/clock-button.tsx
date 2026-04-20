"use client";

import { useActionState, useState, useTransition } from "react";
import {
  clockInAction,
  clockOutAction,
  type ClockState,
} from "./clock-actions";
import { t } from "@/lib/i18n";
import type { LangPref } from "@/lib/preferences";

/**
 * Big tappable Clock In / Clock Out button. Browser geolocation fires on
 * click; whatever we get back is submitted with the server action. If the
 * user denies permission we still clock in — timestamp without coords beats
 * no record at all.
 */

export function ClockButton({
  visitId,
  isOpen,
  lang = "en",
}: {
  visitId: string;
  isOpen: boolean;
  lang?: LangPref;
}) {
  const action = isOpen
    ? clockOutAction.bind(null, visitId)
    : clockInAction.bind(null, visitId);
  const [state, formAction] = useActionState<ClockState, FormData>(
    action,
    null
  );
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleClick() {
    setErr(null);
    const submit = (lat: number | null, lng: number | null) => {
      const fd = new FormData();
      if (lat != null) fd.append("lat", String(lat));
      if (lng != null) fd.append("lng", String(lng));
      startTransition(() => formAction(fd));
    };
    if (!("geolocation" in navigator)) {
      submit(null, null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => submit(pos.coords.latitude, pos.coords.longitude),
      () => submit(null, null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 }
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-bold text-white shadow-sm active:opacity-80 disabled:opacity-60 ${
          isOpen
            ? "bg-red-600"
            : "bg-green-600"
        }`}
      >
        <span className="text-xl">{isOpen ? "⏱" : "🕑"}</span>
        <span>
          {pending
            ? isOpen
              ? `${t(lang, "Clock out")}…`
              : `${t(lang, "Clock in")}…`
            : isOpen
              ? t(lang, "Clock out")
              : t(lang, "Clock in")}
        </span>
      </button>
      {state && !state.ok && (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      )}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
