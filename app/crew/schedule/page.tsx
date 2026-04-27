import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { WeekStrip } from "./week-strip";
import { ViewToggle, type ScheduleView } from "./view-toggle";
import { DayGrid, type DayGridVisit } from "./day-grid";
import { CrewHomeMap } from "../home-map";
import { CreateFab } from "../create-fab";
import { MapsTap } from "@/components/maps-tap";

export const metadata = { title: "Schedule — Rose Concrete" };

type SearchParams = Promise<{ d?: string; view?: string }>;

// Rose Concrete operates in San Diego — every visit on the calendar
// is stamped in PT (PDT/PST). The Vercel server runs in UTC so we
// can't trust `new Date()`'s local methods directly; instead format
// every "today / selected day" through the SD timezone.
const TZ = "America/Los_Angeles";

/** Returns YYYY-MM-DD for `d` evaluated in the SD timezone. */
function tzDateIso(d: Date): string {
  // en-CA always emits ISO-shape (YYYY-MM-DD) regardless of locale,
  // so we don't have to slice/parse.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Day-of-week in the SD timezone — 0=Sun..6=Sat. */
function tzDow(d: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

/** Add `days` calendar days to an ISO date string (YYYY-MM-DD).
 *  Done as a plain string-math operation so we never round-trip
 *  through Date and pick up a timezone shift. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Saturday-anchored week start for the given ISO date (YYYY-MM-DD).
 *  Matches the Jobber screenshot week strip (S 19 … S 25). */
function weekStartIsoFromSelected(selectedIso: string): string {
  const [y, m, d] = selectedIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  // Day-of-week of the SELECTED date in SD time. We constructed `dt`
  // at noon UTC which is 4-5 AM SD — same weekday no matter the DST.
  const dow = tzDow(dt);
  // Days back to Saturday (Sat=6). If today IS Saturday, offset=0.
  const offset = dow === 6 ? 0 : dow + 1;
  return addDays(selectedIso, -offset);
}

function normalizeView(raw: string | undefined): ScheduleView {
  if (raw === "day" || raw === "list" || raw === "map") return raw;
  return "list";
}

type EmployeeColumn = {
  userId: string;
  name: string;
  initials: string;
  totalCount: number;
  completedCount: number;
  visits: VisitRow[];
};

type VisitRow = {
  id: string;
  raw: string;
  durationMin: number | null;
  status: string;
  title: string;
  clientName: string | null;
  address: string | null;
};

/**
 * Crew schedule — Jobber mobile parity (Apr 2026 screenshots).
 *
 *   ┌───────────────────────────────────────────┐
 *   │ April ▼            🗓  ⌘  ✦              │  (top-bar)
 *   │ ┌────┬────┬────┐                          │
 *   │ │ Day│List│ Map│                          │  segmented toggle
 *   │ └────┴────┴────┘                          │
 *   │  S    M    T   W   T   F (24)  S          │  week strip
 *   │  19   20   21  22  23  ●24    25         │
 *   ├──────────────┬───────────────┬────────────┤
 *   │ Roger 0/4    │ Thomas 0/4    │ ...        │  multi-employee columns
 *   │ ┌─────────┐  │ ┌─────────┐   │            │
 *   │ │ Card    │  │ │ Card    │   │            │
 *   │ │ Card    │  │ │ Card    │   │            │
 *   │ └─────────┘  │ └─────────┘   │            │
 *   └──────────────┴───────────────┴────────────┘
 */
export default async function CrewSchedule({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();
  const sp = await searchParams;

  const today = new Date();
  // "Today" + selected day are computed in San Diego time so the
  // schedule lines up with crew expectations regardless of where
  // the Vercel edge runs.
  const todayIso = tzDateIso(today);
  const selectedIso = sp.d ?? todayIso;
  const view = normalizeView(sp.view);
  const weekStart = weekStartIsoFromSelected(selectedIso);
  const weekEndIsoExclusive = addDays(weekStart, 7);
  // Translate the week boundaries back to UTC for the SQL query.
  // Midnight SD = 07:00 UTC during PDT, 08:00 UTC during PST. We use
  // a wide-but-correct boundary by parsing the ISO date as UTC and
  // adjusting -8 hours (PST offset, the LATER of PDT/PST). That way
  // we never miss a visit at the day's start because of DST drift —
  // we may pull a couple of extra hours of the prior day, which is
  // harmless because we filter again client-side by tzDateIso later.
  const weekStartUtc = new Date(`${weekStart}T08:00:00.000Z`);
  const weekEndUtc = new Date(`${weekEndIsoExclusive}T08:00:00.000Z`);
  const weekStartDate = weekStartUtc;
  const weekEnd = weekEndUtc;

  // Pull every visit in the week, joined to project/client AND visit_assignments.
  // We display ALL employees who have visits this week as columns.
  const { data: weekVisits } = await supabase
    .from("visits")
    .select(
      `id, scheduled_for, duration_min, status,
       project:projects(id, name, location, service_address, client:clients(name)),
       assignments:visit_assignments(
         user_id,
         profile:profiles(id, full_name, email)
       )`,
    )
    .gte("scheduled_for", weekStartDate.toISOString())
    .lt("scheduled_for", weekEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  // Day-count badges for the week strip.  Use the SD timezone so a
  // visit scheduled for Friday at 9 PM doesn't roll over into the
  // Saturday count just because UTC shifted.
  const counts: Record<string, number> = {};
  for (const v of weekVisits ?? []) {
    const iso = tzDateIso(new Date(v.scheduled_for));
    counts[iso] = (counts[iso] ?? 0) + 1;
  }

  // Filter to selected day + group by employee — same TZ handling.
  const selectedDay = (weekVisits ?? []).filter(
    (v) => tzDateIso(new Date(v.scheduled_for)) === selectedIso,
  );

  const columns = groupByEmployee(selectedDay);

  // Flat list across employees for the day-grid + map views (which
  // don't split by employee).
  const flat: VisitRow[] = selectedDay.map((v) => {
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    const client = p?.client
      ? Array.isArray(p.client)
        ? p.client[0]
        : p.client
      : null;
    return {
      id: v.id as string,
      raw: v.scheduled_for as string,
      durationMin: v.duration_min as number | null,
      status: v.status as string,
      title: (p?.name ?? "Visit") as string,
      clientName: (client?.name as string | null) ?? null,
      address: (p?.service_address ?? p?.location ?? null) as string | null,
    };
  });

  return (
    <div className="space-y-4">
      {/* View toggle — sits below the top-bar's "April ▼" + filters. */}
      <ViewToggle value={view} />

      <WeekStrip start={weekStart} selected={selectedIso} counts={counts} />

      {view === "day" ? (
        <DayGrid
          visits={flat.map(
            (v): DayGridVisit => ({
              id: v.id,
              scheduled_for: v.raw,
              duration_min: v.durationMin,
              title: v.title,
              clientName: v.clientName,
              status: toCardStatus(v.status),
            }),
          )}
        />
      ) : view === "map" ? (
        <CrewHomeMap
          pins={flat.map((v) => ({ id: v.id, address: v.address }))}
          allAddresses={flat.map((v) => v.address).filter((a): a is string => Boolean(a))}
        />
      ) : columns.length === 0 ? (
        <EmptyDay />
      ) : (
        <EmployeeColumns columns={columns} />
      )}

      <CreateFab />
    </div>
  );
}

function toCardStatus(s: string): "upcoming" | "in_progress" | "completed" | "late" {
  if (s === "completed" || s === "cancelled") return "completed";
  if (s === "in_progress") return "in_progress";
  return "upcoming";
}

function groupByEmployee(
  visits: Array<{
    id: string;
    scheduled_for: string;
    duration_min: number | null;
    status: string;
    project:
      | { name: string; location?: string | null; service_address?: string | null; client?: { name: string } | { name: string }[] | null }
      | Array<{ name: string; location?: string | null; service_address?: string | null; client?: { name: string } | { name: string }[] | null }>
      | null;
    assignments?:
      | Array<{
          user_id: string;
          profile:
            | { id: string; full_name: string | null; email: string }
            | Array<{ id: string; full_name: string | null; email: string }>
            | null;
        }>
      | null;
  }>,
): EmployeeColumn[] {
  const colMap = new Map<string, EmployeeColumn>();
  for (const v of visits) {
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    const client = p?.client
      ? Array.isArray(p.client)
        ? p.client[0]
        : p.client
      : null;
    const row: VisitRow = {
      id: v.id,
      raw: v.scheduled_for,
      durationMin: v.duration_min,
      status: v.status,
      title: p?.name ?? "Visit",
      clientName: client?.name ?? null,
      address: p?.service_address ?? p?.location ?? null,
    };
    const assignments = v.assignments ?? [];
    if (assignments.length === 0) {
      const key = "__unassigned__";
      const col = colMap.get(key) ?? {
        userId: key,
        name: "Unassigned",
        initials: "?",
        totalCount: 0,
        completedCount: 0,
        visits: [],
      };
      col.totalCount += 1;
      if (v.status === "completed") col.completedCount += 1;
      col.visits.push(row);
      colMap.set(key, col);
      continue;
    }
    for (const a of assignments) {
      const profile = Array.isArray(a.profile) ? a.profile[0] : a.profile;
      const name =
        profile?.full_name ?? profile?.email.split("@")[0] ?? "Crew";
      const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((s: string) => s[0]?.toUpperCase() ?? "")
        .join("");
      const col = colMap.get(a.user_id) ?? {
        userId: a.user_id,
        name,
        initials,
        totalCount: 0,
        completedCount: 0,
        visits: [],
      };
      col.totalCount += 1;
      if (v.status === "completed") col.completedCount += 1;
      col.visits.push(row);
      colMap.set(a.user_id, col);
    }
  }
  return Array.from(colMap.values()).sort((a, b) => b.totalCount - a.totalCount);
}

function EmployeeColumns({ columns }: { columns: EmployeeColumn[] }) {
  return (
    <div className="-mx-4">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
        {columns.map((col) => (
          <div
            key={col.userId}
            className="w-[260px] shrink-0 snap-start space-y-2"
          >
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-neutral-800">
              <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                {col.name}
              </p>
              <p className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {col.completedCount}/{col.totalCount}
              </p>
            </div>
            <div className="space-y-2">
              {col.visits.map((v) => (
                <NavyVisitCard key={`${col.userId}-${v.id}`} visit={v} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavyVisitCard({ visit }: { visit: VisitRow }) {
  const start = new Date(visit.raw);
  const end = new Date(start.getTime() + (visit.durationMin ?? 60) * 60_000);
  const time =
    visit.durationMin && visit.durationMin >= 23 * 60
      ? "Anytime"
      : `${start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })} - ${end.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}`;
  return (
    <Link
      href={`/crew/visits/${visit.id}`}
      className="block rounded-lg p-3 active:opacity-90"
      style={{ background: "#1a2332", color: "white" }}
    >
      <p className="truncate text-sm font-bold">{visit.title}</p>
      {visit.clientName && (
        <p className="mt-0.5 truncate text-xs opacity-80">{visit.clientName}</p>
      )}
      <p className="mt-1 truncate text-xs opacity-80">{time}</p>
      {visit.address && (
        <div className="mt-0.5">
          <MapsTap
            address={visit.address}
            showPin={false}
            className="max-w-full truncate text-left text-xs text-white/70 underline decoration-white/30 underline-offset-2 hover:decoration-white"
          />
        </div>
      )}
    </Link>
  );
}

function EmptyDay() {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-neutral-800">
      <p className="text-5xl">🏖</p>
      <p className="mt-3 text-base font-semibold text-[#1a2332] dark:text-white">
        Nothing scheduled.
      </p>
    </div>
  );
}
