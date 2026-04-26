/**
 * Shared Jobber-mobile visit card. Colored left border strip
 * indicates status (green = upcoming / in-progress / completed).
 * The card itself links to the visit detail; the address row
 * peels off via <MapsTap> so a tap there opens Maps instead.
 *
 * Used on crew home (horizontal scroll) + crew schedule list.
 */
import Link from "next/link";
import { MapsTap } from "@/components/maps-tap";

export type CrewJobCardData = {
  id: string;
  title: string;
  time: string;
  clientName: string | null;
  address: string | null;
  status: "upcoming" | "in_progress" | "completed" | "late";
  durationMin?: number | null;
};

const STATUS_COLORS = {
  upcoming: { bar: "#1A7B40", pill: "bg-emerald-100 text-emerald-900" },
  in_progress: { bar: "#E8B74A", pill: "bg-amber-100 text-amber-900" },
  completed: { bar: "#6B7580", pill: "bg-neutral-200 text-neutral-700" },
  late: { bar: "#E0443C", pill: "bg-red-100 text-red-900" },
} as const;

const STATUS_LABEL: Record<CrewJobCardData["status"], string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
  late: "Late",
};

export function CrewJobCard({
  visit,
  variant = "list",
}: {
  visit: CrewJobCardData;
  /** `list` = full-width stacked, `rail` = fixed 280px for horizontal
   *  scrollers on the home screen. */
  variant?: "list" | "rail";
}) {
  const colors = STATUS_COLORS[visit.status];
  const classes =
    variant === "rail"
      ? "w-[280px] shrink-0"
      : "w-full";
  return (
    <Link
      href={`/crew/visits/${visit.id}`}
      className={`relative block overflow-hidden rounded-xl bg-white shadow-sm active:scale-[0.99] dark:bg-neutral-800 ${classes}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: colors.bar }}
      />
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-bold text-[#1a2332] dark:text-white">
            {visit.title}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.pill}`}
          >
            {STATUS_LABEL[visit.status]}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-600 dark:text-neutral-300">
          <span className="font-semibold">🕑 {visit.time}</span>
          {visit.durationMin && <span>{visit.durationMin}m</span>}
        </div>
        {visit.clientName && (
          <p className="mt-1 truncate text-xs text-neutral-700 dark:text-neutral-300">
            {visit.clientName}
          </p>
        )}
        {visit.address && (
          <div className="mt-0.5">
            <MapsTap address={visit.address} />
          </div>
        )}
      </div>
    </Link>
  );
}
