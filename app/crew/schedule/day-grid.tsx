"use client";

/**
 * Hour-grid Day view. 6am → 8pm rows, colored visit blocks sized
 * by duration_min. Taps open the visit detail.
 *
 * Deliberately simple — no drag-to-resize (crew doesn't need it;
 * scheduling happens in the office app).
 */
import Link from "next/link";

const START_HOUR = 6;
const END_HOUR = 20;
const ROW_HEIGHT = 56; // px per hour
const PX_PER_MIN = ROW_HEIGHT / 60;

export type DayGridVisit = {
  id: string;
  scheduled_for: string;
  duration_min: number | null;
  title: string;
  clientName: string | null;
  status: "upcoming" | "in_progress" | "completed" | "late";
};

const STATUS_BG: Record<DayGridVisit["status"], string> = {
  upcoming: "bg-[#4A7C59]/90 border-l-[#4A7C59]",
  in_progress: "bg-[#E8B74A]/90 border-l-[#E8B74A]",
  completed: "bg-neutral-500/90 border-l-neutral-600",
  late: "bg-[#E0443C]/90 border-l-[#E0443C]",
};

export function DayGrid({ visits }: { visits: DayGridVisit[] }) {
  const hours: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h);

  return (
    <div className="relative overflow-hidden rounded-xl bg-white shadow-sm dark:bg-neutral-800">
      <div className="relative" style={{ height: hours.length * ROW_HEIGHT }}>
        {/* Hour rows */}
        {hours.map((h, i) => (
          <div
            key={h}
            className="absolute inset-x-0 border-t border-neutral-100 first:border-0 dark:border-neutral-700"
            style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
          >
            <span className="absolute left-2 top-1 text-[10px] font-semibold uppercase text-neutral-400 dark:text-neutral-500">
              {formatHour(h)}
            </span>
          </div>
        ))}

        {/* Visits */}
        {visits.map((v) => {
          const start = new Date(v.scheduled_for);
          const minutesFromStart =
            (start.getHours() - START_HOUR) * 60 + start.getMinutes();
          const top = Math.max(0, minutesFromStart * PX_PER_MIN);
          const height = Math.max(
            32,
            Math.min((v.duration_min ?? 60) * PX_PER_MIN, 24 * 60 * PX_PER_MIN),
          );
          const time = start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <Link
              key={v.id}
              href={`/crew/visits/${v.id}`}
              className={`absolute left-12 right-2 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs text-white active:opacity-90 ${STATUS_BG[v.status]}`}
              style={{ top, height }}
            >
              <p className="truncate text-[11px] font-bold">{v.title}</p>
              <p className="truncate text-[10px] opacity-80">
                {time} · {v.clientName ?? "—"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
