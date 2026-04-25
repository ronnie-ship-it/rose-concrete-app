import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { WeekStrip } from "./week-strip";
import { ViewToggle, type ScheduleView } from "./view-toggle";
import { DayGrid, type DayGridVisit } from "./day-grid";
import { CrewHomeMap } from "../home-map";
import { CreateFab } from "../create-fab";

export const metadata = { title: "Schedule — Rose Concrete" };

type SearchParams = Promise<{ d?: string; view?: string }>;

function weekStartIso(d: Date): string {
  // Saturday-anchored week (matches the Apr 24 2026 screenshots:
  // S 19, M 20, T 21, W 22, T 23, F 24, S 25 — so the week starts on
  // Saturday the 19th).
  const day = d.getDay(); // 0=Sun..6=Sat
  const start = new Date(d);
  const offset = day === 6 ? 0 : day + 1;
  start.setDate(d.getDate() - offset);
  start.setHours(12, 0, 0, 0);
  return start.toISOString().slice(0, 10);
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
  const selectedIso = sp.d ?? today.toISOString().slice(0, 10);
  const view = normalizeView(sp.view);
  const weekStart = weekStartIso(new Date(selectedIso + "T12:00:00"));
  const weekStartDate = new Date(weekStart + "T00:00:00");
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

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

  // Day-count badges for the week strip.
  const counts: Record<string, number> = {};
  for (const v of weekVisits ?? []) {
    const iso = new Date(v.scheduled_for).toISOString().slice(0, 10);
    counts[iso] = (counts[iso] ?? 0) + 1;
  }

  // Filter to selected day + group by employee.
  const selectedDay = (weekVisits ?? []).filter(
    (v) => new Date(v.scheduled_for).toISOString().slice(0, 10) === selectedIso,
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
        <p className="mt-0.5 truncate text-xs opacity-70">{visit.address}</p>
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
