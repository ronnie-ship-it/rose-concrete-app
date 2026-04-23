"use client";

/**
 * S M T W T F S week strip with today circled green. Each day is
 * tappable — updates the URL's `?d=YYYY-MM-DD` param so the parent
 * page re-renders with that day selected. Badge shows the visit
 * count for that day when > 0.
 */
import { useRouter, useSearchParams } from "next/navigation";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekStrip({
  start,
  selected,
  counts,
}: {
  /** ISO date of Sunday. */
  start: string;
  /** ISO date currently selected. */
  selected: string;
  /** Visits-count per date, keyed by `YYYY-MM-DD`. */
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
    days.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getDate(),
      label: DAYS[i],
    });
  }

  function pick(iso: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("d", iso);
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-1 rounded-xl bg-white p-2 shadow-sm dark:bg-neutral-800">
      {days.map((d) => {
        const isSelected = d.iso === selected;
        const isToday = d.iso === today;
        const count = counts[d.iso] ?? 0;
        return (
          <button
            key={d.iso}
            type="button"
            onClick={() => pick(d.iso)}
            className="relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 transition hover:bg-neutral-50 dark:hover:bg-neutral-700"
            aria-pressed={isSelected}
          >
            <span className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              {d.label}
            </span>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                isSelected
                  ? "bg-[#4A7C59] text-white"
                  : isToday
                    ? "border-2 border-[#4A7C59] text-[#4A7C59]"
                    : "text-[#1a2332] dark:text-white"
              }`}
            >
              {d.day}
            </span>
            {count > 0 && !isSelected && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#E8B74A] px-1 text-[9px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
