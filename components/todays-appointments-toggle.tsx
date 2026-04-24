"use client";

/**
 * Segmented Visit / Employee toggle for the Today's Appointments panel.
 * Drives the group-by mode via `?appts=visit|employee` URL param so the
 * selection survives reloads.
 */
import { useRouter, useSearchParams } from "next/navigation";

export function TodayApptToggle({ current }: { current: "visit" | "employee" }) {
  const router = useRouter();
  const sp = useSearchParams();
  function go(next: "visit" | "employee") {
    const params = new URLSearchParams(sp.toString());
    if (next === "visit") params.delete("appts");
    else params.set("appts", "employee");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?");
  }
  return (
    <div className="inline-flex rounded-full bg-neutral-100 p-1 text-xs font-bold dark:bg-white/5">
      <button
        type="button"
        onClick={() => go("visit")}
        className={`rounded-full px-4 py-1.5 transition ${
          current === "visit"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-jobber-card dark:text-white"
            : "text-neutral-500 dark:text-jobber-text-2"
        }`}
      >
        Visit
      </button>
      <button
        type="button"
        onClick={() => go("employee")}
        className={`rounded-full px-4 py-1.5 transition ${
          current === "employee"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-jobber-card dark:text-white"
            : "text-neutral-500 dark:text-jobber-text-2"
        }`}
      >
        Employee
      </button>
    </div>
  );
}
