import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { money } from "@/lib/format";
import { TodayApptToggle } from "./todays-appointments-toggle";

/**
 * Jobber-parity "Today's appointments" panel on the dashboard home.
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ Total $4,350 │ Active $0 │ Completed $0 │ Overdue $4k │ Remaining $0 │
 *   │                                          [View Schedule] │
 *   │  ( Visit | Employee )   segmented toggle                  │
 *   │                                                           │
 *   │  1 OVERDUE                                                │
 *   │   ▍ Earl Parker — Basic Driveway …    2–4 PM  TRR RW $4,350│
 *   │                                                           │
 *   │  1 ACTIVE                                                 │
 *   │   ▍ Charles Hansen — Sidewalk pour   7:30–3:30 PM   TRR   │
 *   │                                                           │
 *   │  0 REMAINING                                              │
 *   │     [ No scheduled events ]                               │
 *   │                                                           │
 *   │  2 COMPLETED                                              │
 *   │   ▍ Richard Jaynes — Driveway estimate   Anytime          │
 *   │                                                           │
 *   └────────────────────────────────────────────────────────┘
 *
 * Groups are computed server-side by comparing each visit's scheduled_for
 * + duration against "now":
 *   completed  — status = completed
 *   overdue    — scheduled_for + duration < now (and not completed)
 *   active     — scheduled_for <= now < scheduled_for + duration
 *   remaining  — scheduled_for > now
 */
export async function TodaysAppointments({
  view = "visit",
}: {
  view?: "visit" | "employee";
}) {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const { data: visits } = await supabase
    .from("visits")
    .select(
      `id, scheduled_for, duration_min, status,
       project:projects(id, name, revenue_cached, client:clients(name)),
       assignments:visit_assignments(
         user_id,
         profile:profiles(id, full_name, email)
       )`,
    )
    .gte("scheduled_for", todayStart.toISOString())
    .lt("scheduled_for", todayEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  type Row = {
    id: string;
    title: string;
    clientName: string | null;
    scheduled_for: Date;
    end: Date;
    amount: number;
    status: string;
    assigneeInitials: string[];
    assigneeNames: string[];
    bucket: "overdue" | "active" | "remaining" | "completed";
  };

  const rows: Row[] = [];
  for (const v of visits ?? []) {
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    const c = p?.client
      ? Array.isArray(p.client)
        ? p.client[0]
        : p.client
      : null;
    const scheduledFor = new Date(v.scheduled_for as string);
    const end = new Date(scheduledFor.getTime() + ((v.duration_min as number) ?? 60) * 60_000);
    const status = v.status as string;
    const assignments = (v.assignments ?? []) as Array<{
      user_id: string;
      profile:
        | { id: string; full_name: string | null; email: string }
        | Array<{ id: string; full_name: string | null; email: string }>
        | null;
    }>;
    const initials: string[] = [];
    const names: string[] = [];
    for (const a of assignments) {
      const pr = Array.isArray(a.profile) ? a.profile[0] : a.profile;
      const nm = pr?.full_name ?? pr?.email ?? "";
      names.push(nm);
      initials.push(
        nm
          .split(/\s+/)
          .slice(0, 3)
          .map((s) => s[0]?.toUpperCase() ?? "")
          .join(""),
      );
    }

    let bucket: Row["bucket"];
    if (status === "completed") bucket = "completed";
    else if (end < now) bucket = "overdue";
    else if (scheduledFor <= now) bucket = "active";
    else bucket = "remaining";

    rows.push({
      id: v.id as string,
      title: (p?.name as string) ?? "Visit",
      clientName: (c?.name as string | null) ?? null,
      scheduled_for: scheduledFor,
      end,
      amount: Number(p?.revenue_cached ?? 0),
      status,
      assigneeInitials: initials,
      assigneeNames: names,
      bucket,
    });
  }

  const overdue = rows.filter((r) => r.bucket === "overdue");
  const active = rows.filter((r) => r.bucket === "active");
  const remaining = rows.filter((r) => r.bucket === "remaining");
  const completed = rows.filter((r) => r.bucket === "completed");

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const activeTotal = active.reduce((s, r) => s + r.amount, 0);
  const completedTotal = completed.reduce((s, r) => s + r.amount, 0);
  const overdueTotal = overdue.reduce((s, r) => s + r.amount, 0);
  const remainingTotal = remaining.reduce((s, r) => s + r.amount, 0);

  // Employee grouping — collapse rows under each assignee when view=employee.
  const groupedRows = view === "employee" ? groupByEmployee(rows) : null;

  const todayIso = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, "0")}-${String(todayStart.getDate()).padStart(2, "0")}`;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-jobber-line dark:bg-jobber-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
          Today&apos;s appointments
        </h2>
        <Link
          href={`/dashboard/schedule?d=${todayIso}`}
          className="inline-flex items-center justify-center rounded-full border border-jobber-green px-4 py-1.5 text-xs font-bold text-jobber-green hover:bg-jobber-green/10"
        >
          View Schedule
        </Link>
      </div>

      {/* Summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryTile label="Total" value={money(total)} />
        <SummaryTile
          label="Active"
          value={money(activeTotal)}
          tone={activeTotal > 0 ? "green" : "muted"}
        />
        <SummaryTile label="Completed" value={money(completedTotal)} />
        <SummaryTile
          label="Overdue"
          value={money(overdueTotal)}
          tone={overdueTotal > 0 ? "red" : "muted"}
        />
        <SummaryTile label="Remaining" value={money(remainingTotal)} />
      </div>

      {/* Visit / Employee toggle */}
      <div className="mt-4">
        <TodayApptToggle current={view} />
      </div>

      {/* Groups */}
      <div className="mt-4 space-y-5">
        {view === "employee" && groupedRows ? (
          <EmployeeGroups groupedRows={groupedRows} />
        ) : (
          <>
            <Group label={`${overdue.length} OVERDUE`} rows={overdue} emptyLabel="No overdue visits" />
            <Group label={`${active.length} ACTIVE`} rows={active} emptyLabel="No active visits" />
            <Group
              label={`${remaining.length} REMAINING`}
              rows={remaining}
              emptyLabel="No Scheduled Events"
              muted
            />
            <Group
              label={`${completed.length} COMPLETED`}
              rows={completed}
              emptyLabel="Nothing completed yet"
              completed
            />
          </>
        )}
      </div>
    </section>
  );
}

function groupByEmployee(rows: Array<{
  id: string;
  title: string;
  clientName: string | null;
  scheduled_for: Date;
  end: Date;
  amount: number;
  status: string;
  assigneeInitials: string[];
  assigneeNames: string[];
  bucket: "overdue" | "active" | "remaining" | "completed";
}>): Map<string, Array<{
  id: string;
  title: string;
  clientName: string | null;
  scheduled_for: Date;
  end: Date;
  amount: number;
  status: string;
  assigneeInitials: string[];
  assigneeNames: string[];
  bucket: "overdue" | "active" | "remaining" | "completed";
}>> {
  const m = new Map<string, typeof rows>();
  for (const r of rows) {
    const keys = r.assigneeNames.length > 0 ? r.assigneeNames : ["Unassigned"];
    for (const k of keys) {
      const list = m.get(k) ?? [];
      list.push(r);
      m.set(k, list);
    }
  }
  return m;
}

function EmployeeGroups({
  groupedRows,
}: {
  groupedRows: Map<string, Array<{
    id: string;
    title: string;
    clientName: string | null;
    scheduled_for: Date;
    end: Date;
    amount: number;
    status: string;
    assigneeInitials: string[];
    assigneeNames: string[];
    bucket: "overdue" | "active" | "remaining" | "completed";
  }>>;
}) {
  if (groupedRows.size === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500 dark:border-jobber-line dark:text-jobber-text-2">
        No employees are scheduled today.
      </div>
    );
  }
  return (
    <>
      {Array.from(groupedRows.entries()).map(([employee, rows]) => (
        <Group
          key={employee}
          label={`${employee.toUpperCase()} (${rows.length})`}
          rows={rows}
          emptyLabel=""
        />
      ))}
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "red" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-jobber-red"
      : tone === "green"
        ? "text-jobber-green"
        : "text-neutral-900 dark:text-white";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-jobber-text-2">
        {label}
      </p>
      <p className={`mt-0.5 text-xl font-extrabold ${toneClass}`}>{value}</p>
    </div>
  );
}

type Row = {
  id: string;
  title: string;
  clientName: string | null;
  scheduled_for: Date;
  end: Date;
  amount: number;
  status: string;
  assigneeInitials: string[];
  assigneeNames: string[];
  bucket: "overdue" | "active" | "remaining" | "completed";
};

function Group({
  label,
  rows,
  emptyLabel,
  muted = false,
  completed = false,
}: {
  label: string;
  rows: Row[];
  emptyLabel: string;
  muted?: boolean;
  completed?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-jobber-text-2">
        {label}
      </p>
      {rows.length === 0 ? (
        <div
          className={`rounded-md border border-dashed p-5 text-center text-xs ${
            muted
              ? "border-neutral-200 text-neutral-400 dark:border-jobber-line dark:text-jobber-text-3"
              : "border-neutral-200 text-neutral-500 dark:border-jobber-line dark:text-jobber-text-2"
          }`}
        >
          {emptyLabel}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 dark:divide-jobber-line dark:border-jobber-line">
          {rows.map((r) => (
            <li key={`${r.id}-${label}`}>
              <ApptRow row={r} completed={completed} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApptRow({ row, completed }: { row: Row; completed: boolean }) {
  const barColor =
    row.bucket === "active"
      ? "bg-jobber-green"
      : row.bucket === "overdue"
        ? "bg-jobber-red"
        : row.bucket === "completed"
          ? "bg-neutral-400 dark:bg-jobber-text-3"
          : "bg-neutral-300 dark:bg-jobber-line";
  const titleTone = completed
    ? "text-neutral-400 line-through dark:text-jobber-text-3"
    : "text-neutral-900 dark:text-white";
  const timeLabel = isAnytime(row)
    ? "Anytime"
    : `${fmtTime(row.scheduled_for)} – ${fmtTime(row.end)}`;

  return (
    <Link
      href={`/dashboard/schedule/${row.id}`}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-white/5"
    >
      <span className={`h-10 w-1 shrink-0 rounded-sm ${barColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${titleTone}`}>
          {row.clientName ? `${row.clientName} — ${row.title}` : row.title}
        </p>
        <p className="truncate text-xs text-neutral-500 dark:text-jobber-text-2">
          {timeLabel}
        </p>
      </div>
      {row.assigneeInitials.length > 0 && (
        <div className="flex -space-x-1">
          {row.assigneeInitials.slice(0, 3).map((ini, i) => (
            <span
              key={i}
              title={row.assigneeNames[i]}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[10px] font-bold text-neutral-700 dark:border-jobber-card dark:bg-white/10 dark:text-white"
            >
              {ini || "?"}
            </span>
          ))}
        </div>
      )}
      {row.amount > 0 && (
        <p className="shrink-0 text-sm font-bold text-neutral-900 dark:text-white">
          {money(row.amount)}
        </p>
      )}
    </Link>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
function isAnytime(r: { scheduled_for: Date; end: Date }): boolean {
  // If the visit starts at 00:00 and has a full-day duration, show Anytime.
  return r.scheduled_for.getHours() === 0 && r.end.getTime() - r.scheduled_for.getTime() >= 23 * 3600_000;
}
