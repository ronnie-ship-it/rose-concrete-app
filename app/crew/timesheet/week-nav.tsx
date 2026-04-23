"use client";

/**
 * Previous-week / This-week / Next-week navigation strip for the
 * timesheet. Pushes `?start=YYYY-MM-DD` so the server can re-query.
 */
import { useRouter, useSearchParams } from "next/navigation";

export function WeekNav({ startIso }: { startIso: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(delta: number) {
    const d = new Date(startIso + "T12:00:00");
    d.setDate(d.getDate() + delta * 7);
    const params = new URLSearchParams(sp.toString());
    params.set("start", d.toISOString().slice(0, 10));
    router.replace(`?${params.toString()}`);
  }

  function goThis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() - today.getDay());
    const params = new URLSearchParams(sp.toString());
    params.delete("start");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : `/crew/timesheet`);
    void today; // (this-week is just a URL with no start param)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous week"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-50 dark:bg-neutral-800"
      >
        <span className="text-lg">‹</span>
      </button>
      <button
        type="button"
        onClick={goThis}
        className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#4A7C59] shadow-sm active:bg-neutral-50 dark:bg-neutral-800"
      >
        This week
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next week"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-50 dark:bg-neutral-800"
      >
        <span className="text-lg">›</span>
      </button>
    </div>
  );
}
