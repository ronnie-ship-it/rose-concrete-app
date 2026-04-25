"use client";

/**
 * S M T W T F S week strip — Jobber mobile parity (Apr 2026 screenshots).
 *
 * Layout: 7 columns, each shows the day letter on top in muted gray
 * and the day number below. The currently-selected day shows a SOLID
 * GREEN circle around the number (white text). Plain on the page bg
 * — no card or shadow.
 *
 * The Apr 19 2026 screenshot shows: S 19 / M 20 / T 21 / W 22 / T 23 /
 * F 24 (selected) / S 25.  So the week is Saturday-anchored.
 */
import { useRouter, useSearchParams } from "next/navigation";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekStrip({
  start,
  selected,
  counts,
}: {
  /** ISO date of Saturday (week start). */
  start: string;
  /** ISO date currently selected. */
  selected: string;
  /** Visit count per ISO date. */
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);

  const days: Array<{ iso: string; day: number; label: string }> = [];
  const base = new Date(start + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    // Letter rotates with the day-of-week of the actual date so we
    // always show the right letter regardless of week anchoring.
    const letter = LETTERS[d.getDay()];
    days.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getDate(),
      label: letter,
    });
  }

  function pick(iso: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("d", iso);
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-7 gap-0">
      {days.map((d) => {
        const isSelected = d.iso === selected;
        const isToday = d.iso === today && !isSelected;
        const count = counts[d.iso] ?? 0;
        return (
          <button
            key={d.iso}
            type="button"
            onClick={() => pick(d.iso)}
            className="relative flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 transition active:bg-neutral-100 dark:active:bg-neutral-800"
            aria-pressed={isSelected}
          >
            <span className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              {d.label}
            </span>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold transition ${
                isSelected
                  ? "bg-[#1A7B40] text-white"
                  : isToday
                    ? "text-[#1A7B40]"
                    : "text-[#1a2332] dark:text-white"
              }`}
            >
              {d.day}
            </span>
            {count > 0 && !isSelected && (
              <span
                aria-hidden="true"
                className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#1A7B40]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
