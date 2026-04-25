"use client";

/**
 * Segmented Day / List / Map view toggle. URL-driven (`?view=`),
 * so back-button navigation replays the view.
 */
import { useRouter, useSearchParams } from "next/navigation";

export type ScheduleView = "day" | "list" | "map";

export function ViewToggle({ value }: { value: ScheduleView }) {
  const router = useRouter();
  const sp = useSearchParams();

  function pick(v: ScheduleView) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("view", v);
    router.replace(`?${params.toString()}`);
  }

  const options: Array<{ value: ScheduleView; label: string }> = [
    { value: "day", label: "Day" },
    { value: "list", label: "List" },
    { value: "map", label: "Map" },
  ];

  return (
    <div
      role="tablist"
      aria-label="View"
      className="grid grid-cols-3 gap-0 rounded-full bg-neutral-100 p-1 text-sm font-bold dark:bg-neutral-800"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => pick(o.value)}
            className={`rounded-full px-3 py-2 transition ${
              active
                ? "bg-white text-[#1a2332] shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
