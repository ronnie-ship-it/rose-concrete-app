"use client";

/**
 * EN/ES toggle for the crew PWA. A pill-shaped two-button group instead of
 * a dropdown — faster to read on a phone in daylight and obvious at a glance.
 */
import { useTransition } from "react";
import { toggleLangAction } from "@/app/actions/preferences";
import type { LangPref } from "@/lib/preferences";

export function LangToggle({ initial }: { initial: LangPref }) {
  const [isPending, startTransition] = useTransition();

  function pick(next: LangPref) {
    if (next === initial) return;
    startTransition(async () => {
      await toggleLangAction(next);
    });
  }

  const base =
    "px-2 py-1 text-[11px] font-semibold transition disabled:opacity-50";
  const active = "bg-brand-600 text-white";
  const inactive = "bg-white text-neutral-700";

  return (
    <div
      className="inline-flex overflow-hidden rounded-full border border-neutral-300"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => pick("en")}
        disabled={isPending}
        className={`${base} ${initial === "en" ? active : inactive}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => pick("es")}
        disabled={isPending}
        className={`${base} ${initial === "es" ? active : inactive}`}
      >
        ES
      </button>
    </div>
  );
}
