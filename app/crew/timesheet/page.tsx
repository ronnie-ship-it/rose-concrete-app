import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";
import { WeekNav } from "./week-nav";

export const metadata = { title: "Timesheet — Rose Concrete" };

type SearchParams = Promise<{ start?: string }>;

/**
 * Crew timesheet — Jobber mobile parity.
 *
 *   ┌───────────────────────────────────┐
 *   │  This week                        │
 *   │  32h 45m                          │   big total at top
 *   │  Apr 21 – Apr 27                   │
 *   │  ←            [This week]       → │   week nav
 *   │                                   │
 *   │  MON APR 21                 6h 30m│
 *   │   ├─ Driveway pour                │
 *   │   │   8:02a – 11:30a (3h 28m)    │
 *   │   ├─ Kimberly Way                 │
 *   │   │   1:10p – 4:05p  (2h 55m)    │
 *   │   └─ (still clocked in)           │
 *   │                                   │
 *   │  TUE APR 22                 7h 12m│
 *   │   └─ Patio pour …                 │
 *   │  …                                │
 *   └───────────────────────────────────┘
 */
export default async function CrewTimesheet({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole(["crew", "admin", "office"]);
  const lang = await getLangPref();
  const supabase = await createClient();
  const sp = await searchParams;

  const today = new Date();
  const start = sp.start
    ? new Date(sp.start + "T00:00:00")
    : weekStartOf(today);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  // Full weekly window of time entries for this user — joined to visit +
  // project + client so the cards can show context.
  const { data: entries } = await supabase
    .from("visit_time_entries")
    .select(
      `id, clock_in_at, clock_out_at,
       visit:visits(
         id,
         project:projects(id, name, client:clients(name))
       )`,
    )
    .eq("user_id", user.id)
    .gte("clock_in_at", start.toISOString())
    .lt("clock_in_at", end.toISOString())
    .order("clock_in_at", { ascending: true });

  // Bucket by day.
  type Row = {
    id: string;
    visitId: string | null;
    title: string;
    clientName: string | null;
    clockIn: Date;
    clockOut: Date | null;
    durationMs: number; // actual or estimated-now for open clocks
    isOpen: boolean;
  };
  const byDay = new Map<string, Row[]>();
  let weekTotalMs = 0;
  let weekOpenCount = 0;

  for (const e of entries ?? []) {
    const v = Array.isArray(e.visit) ? e.visit[0] : e.visit;
    const p = v?.project
      ? Array.isArray(v.project)
        ? v.project[0]
        : v.project
      : null;
    const c = p?.client
      ? Array.isArray(p.client)
        ? p.client[0]
        : p.client
      : null;
    const clockIn = new Date(e.clock_in_at as string);
    const clockOut = e.clock_out_at ? new Date(e.clock_out_at as string) : null;
    const isOpen = clockOut == null;
    const end = clockOut ?? today;
    const durationMs = Math.max(0, end.getTime() - clockIn.getTime());
    weekTotalMs += durationMs;
    if (isOpen) weekOpenCount += 1;

    const iso = clockIn.toISOString().slice(0, 10);
    const row: Row = {
      id: e.id as string,
      visitId: (v?.id as string | undefined) ?? null,
      title: (p?.name as string | undefined) ?? "Visit",
      clientName: (c?.name as string | undefined) ?? null,
      clockIn,
      clockOut,
      durationMs,
      isOpen,
    };
    const list = byDay.get(iso) ?? [];
    list.push(row);
    byDay.set(iso, list);
  }

  // Build 7 day rows (even empty ones).
  const days: Array<{ iso: string; date: Date; rows: Row[]; totalMs: number }> =
    [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const rows = byDay.get(iso) ?? [];
    const totalMs = rows.reduce((s, r) => s + r.durationMs, 0);
    days.push({ iso, date: d, rows, totalMs });
  }

  const weekRangeLabel = `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${new Date(end.getTime() - 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;

  const isThisWeek = sameDay(start, weekStartOf(today));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {isThisWeek ? t(lang, "This week") : t(lang, "Week of")}
        </h1>
        <p className="mt-1 text-4xl font-extrabold text-[#1a2332] dark:text-white">
          {formatDuration(weekTotalMs)}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {weekRangeLabel}
          {weekOpenCount > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-[#4A7C59]">
                {weekOpenCount} clocked in now
              </span>
            </>
          )}
        </p>
      </div>

      <WeekNav startIso={start.toISOString().slice(0, 10)} />

      <ul className="space-y-3">
        {days.map((d) => (
          <DayCard key={d.iso} date={d.date} totalMs={d.totalMs} rows={d.rows} />
        ))}
      </ul>
    </div>
  );
}

function DayCard({
  date,
  totalMs,
  rows,
}: {
  date: Date;
  totalMs: number;
  rows: Array<{
    id: string;
    visitId: string | null;
    title: string;
    clientName: string | null;
    clockIn: Date;
    clockOut: Date | null;
    durationMs: number;
    isOpen: boolean;
  }>;
}) {
  const isEmpty = rows.length === 0;
  return (
    <li className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-neutral-800">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#1a2332] dark:text-white">
          {date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="text-sm font-bold tabular-nums text-[#1a2332] dark:text-white">
          {isEmpty ? "—" : formatDuration(totalMs)}
        </p>
      </div>
      {isEmpty ? (
        <p className="px-4 pb-3 pt-1 text-xs text-neutral-400">No hours</p>
      ) : (
        <ul className="mt-1 divide-y divide-neutral-100 dark:divide-neutral-700">
          {rows.map((r) => (
            <li key={r.id}>
              <EntryLink row={r} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function EntryLink({
  row,
}: {
  row: {
    id: string;
    visitId: string | null;
    title: string;
    clientName: string | null;
    clockIn: Date;
    clockOut: Date | null;
    durationMs: number;
    isOpen: boolean;
  };
}) {
  const content = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          row.isOpen ? "bg-[#4A7C59] animate-pulse" : "bg-neutral-300"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
          {row.title}
        </p>
        {row.clientName && (
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {row.clientName}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          {row.clockIn.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          –{" "}
          {row.clockOut
            ? row.clockOut.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "now"}
        </p>
      </div>
      <p className="shrink-0 text-sm font-bold tabular-nums text-[#1a2332] dark:text-white">
        {formatDuration(row.durationMs)}
      </p>
    </div>
  );
  if (!row.visitId) return content;
  return (
    <Link
      href={`/crew/visits/${row.visitId}`}
      className="block active:bg-neutral-50 dark:active:bg-neutral-700"
    >
      {content}
    </Link>
  );
}

function weekStartOf(d: Date): Date {
  // Sunday-anchored, matches /crew/schedule.
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
