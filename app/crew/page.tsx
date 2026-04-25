import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ClockButton } from "./clock-button";
import { CrewHomeMap } from "./home-map";
import { CreateFab } from "./create-fab";
import Link from "next/link";
import { money } from "@/lib/format";

export const metadata = { title: "Home — Rose Concrete" };

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}
function startOfWeekSat(d: Date): Date {
  // Saturday-anchored week (Apr 19 = Saturday in the screenshot).
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun..6=Sat
  // Step back to most recent Saturday: if today is Sat (6), 0 days; otherwise day+1.
  const offset = day === 6 ? 0 : day + 1;
  out.setDate(out.getDate() - offset);
  return out;
}
function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function fmtDateRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} - ${e}`;
}
function pctDelta(now: number, prev: number): { dir: "up" | "down"; pct: number } | null {
  if (prev === 0 && now === 0) return null;
  if (prev === 0) return { dir: "up", pct: 100 };
  const delta = ((now - prev) / prev) * 100;
  if (Math.abs(delta) < 1) return null;
  return { dir: delta > 0 ? "up" : "down", pct: Math.round(Math.abs(delta)) };
}
function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Crew home — Jobber mobile parity (per Apr 2026 screenshots).
 *
 * Top of scroll:
 *   ┌──────────────────────────────────────┐
 *   │ Friday, April 24th       🔔(7)  ✦   │   (in top-bar)
 *   │                                      │
 *   │ Good evening, Thomas                 │   big bold
 *   │                                      │
 *   │ ┌──────────────────────────────────┐ │
 *   │ │ Let's get started   [▶ Clock In] │ │   single-row card
 *   │ └──────────────────────────────────┘ │
 *   │                                      │
 *   │ [ map of today's visits, View all > ]│
 *   │                                      │
 *   │ ┌─ No visits scheduled today ─┐      │   gray empty card
 *   │ └─────────────────────────────┘      │
 *   │                                      │
 *   │ This week                View timesheet
 *   │ Apr 19 - 25                          │
 *   │ Total completed time            00:00│
 *   │                                      │
 *   │ To do                                │
 *   │  📥  64 new requests             →   │
 *   │  📥  23 assessments completed    →   │
 *   │  🔍  31 approved quotes              →
 *   │       Worth $243k                    │
 *   │  🔨  12 action required jobs     →   │
 *   │       Worth $29.2k                   │
 *   │  🔨  43 require invoicing jobs   →   │
 *   │       Worth $138.6k                  │
 *   │                                      │
 *   │ Business health          View all    │
 *   │ Job value                  $7.8k ↑1% │
 *   │  This week (Apr 19 - 25)             │
 *   │ Visits scheduled              3 ↓57% │
 *   │  This week (Apr 19 - 25)             │
 *   │                                      │
 *   └──────────────────────────────────────┘
 *                                       (●) FAB
 */
export default async function CrewHome() {
  const user = await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekStart = startOfWeekSat(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Sat..Fri inclusive
  const weekEndExclusive = new Date(weekStart);
  weekEndExclusive.setDate(weekEndExclusive.getDate() + 7);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600_000).toISOString();

  // Fan out the queries — they're independent, so Promise.all keeps the
  // SSR render fast.
  const [
    todayVisitsRes,
    weekTimeRes,
    requestsNew,
    requestsAssessmentsDone,
    quotesApproved,
    jobsActionRequired,
    jobsRequireInvoicing,
    weekVisitsRes,
    prevWeekVisitsRes,
    weekJobValueRes,
    prevWeekJobValueRes,
  ] = await Promise.all([
    supabase
      .from("visits")
      .select(
        "id, scheduled_for, duration_min, status, project:projects(id, name, location, service_address, revenue_cached, client:clients(name, phone))",
      )
      .gte("scheduled_for", todayStart.toISOString())
      .lte("scheduled_for", todayEnd.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("visit_time_entries")
      .select("clock_in_at, clock_out_at")
      .eq("user_id", user.id)
      .gte("clock_in_at", weekStart.toISOString())
      .lt("clock_in_at", weekEndExclusive.toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "qualified"),
    supabase
      .from("quotes")
      .select("id, accepted_total, base_total")
      .eq("status", "accepted"),
    supabase
      .from("projects")
      .select("id, revenue_cached")
      .in("status", ["scheduled", "active"])
      .lt("scheduled_start", fortyEightHoursAgo),
    supabase
      .from("projects")
      .select("id, revenue_cached")
      .eq("status", "done")
      .is("invoice_scheduled_for", null),
    supabase
      .from("visits")
      .select("id, project:projects(revenue_cached)")
      .gte("scheduled_for", weekStart.toISOString())
      .lt("scheduled_for", weekEndExclusive.toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("visits")
      .select("id")
      .gte("scheduled_for", prevWeekStart.toISOString())
      .lt("scheduled_for", weekStart.toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("visits")
      .select("project:projects(revenue_cached)")
      .gte("scheduled_for", weekStart.toISOString())
      .lt("scheduled_for", weekEndExclusive.toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("visits")
      .select("project:projects(revenue_cached)")
      .gte("scheduled_for", prevWeekStart.toISOString())
      .lt("scheduled_for", weekStart.toISOString())
      .neq("status", "cancelled"),
  ]);

  const todayVisits = todayVisitsRes.data ?? [];

  // Total completed time this week — sum of clock-out − clock-in for
  // every closed entry; open entries don't count yet.
  const totalCompletedMs = (weekTimeRes.data ?? []).reduce((sum, e) => {
    if (!e.clock_out_at) return sum;
    return sum + (new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime());
  }, 0);

  // Sum revenue from quote.accepted_total falling back to base_total.
  const sumQuoteValue = (
    rows: Array<{ accepted_total?: number | string | null; base_total?: number | string | null }>,
  ) =>
    rows.reduce(
      (s, r) => s + Number(r.accepted_total ?? r.base_total ?? 0),
      0,
    );
  const sumRevenue = (rows: Array<{ revenue_cached?: number | string | null }>) =>
    rows.reduce((s, r) => s + Number(r.revenue_cached ?? 0), 0);
  const sumNestedRevenue = (rows: Array<{ project: { revenue_cached?: number | string | null } | Array<{ revenue_cached?: number | string | null }> | null }>) =>
    rows.reduce((s, r) => {
      const p = Array.isArray(r.project) ? r.project[0] : r.project;
      return s + Number(p?.revenue_cached ?? 0);
    }, 0);

  // Dedupe project IDs per week so a multi-visit job doesn't double-count.
  const dedupRevenue = (rows: Array<{ project: { id?: string; revenue_cached?: number | string | null } | Array<{ id?: string; revenue_cached?: number | string | null }> | null }>) => {
    const seen = new Set<string>();
    let total = 0;
    for (const r of rows) {
      const p = Array.isArray(r.project) ? r.project[0] : r.project;
      const id = p?.id;
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      total += Number(p.revenue_cached ?? 0);
    }
    return total;
  };

  const todoRows = [
    {
      key: "requests-new",
      icon: <Icon kind="inbox" tone="gold" />,
      label: `${requestsNew.count ?? 0} new requests`,
      sub: null,
      href: "/dashboard/requests?status=new",
    },
    {
      key: "requests-assessments",
      icon: <Icon kind="inbox" tone="gold" />,
      label: `${requestsAssessmentsDone.count ?? 0} assessments completed requests`,
      sub: null,
      href: "/dashboard/requests?status=qualified",
    },
    {
      key: "quotes-approved",
      icon: <Icon kind="search" tone="pink" />,
      label: `${(quotesApproved.data ?? []).length} approved quotes`,
      sub:
        sumQuoteValue(quotesApproved.data ?? []) > 0
          ? `Worth ${money(sumQuoteValue(quotesApproved.data ?? []))}`
          : null,
      href: "/dashboard/quotes?status=accepted",
    },
    {
      key: "jobs-action",
      icon: <Icon kind="hammer" tone="green" />,
      label: `${(jobsActionRequired.data ?? []).length} action required jobs`,
      sub:
        sumRevenue(jobsActionRequired.data ?? []) > 0
          ? `Worth ${money(sumRevenue(jobsActionRequired.data ?? []))}`
          : null,
      href: "/dashboard/projects?status=scheduled",
    },
    {
      key: "jobs-invoice",
      icon: <Icon kind="hammer" tone="green" />,
      label: `${(jobsRequireInvoicing.data ?? []).length} require invoicing jobs`,
      sub:
        sumRevenue(jobsRequireInvoicing.data ?? []) > 0
          ? `Worth ${money(sumRevenue(jobsRequireInvoicing.data ?? []))}`
          : null,
      href: "/dashboard/projects?status=done",
    },
  ];

  const visitsThisWeekCount = (weekVisitsRes.data ?? []).length;
  const visitsPrevWeekCount = (prevWeekVisitsRes.data ?? []).length;
  const visitsDelta = pctDelta(visitsThisWeekCount, visitsPrevWeekCount);

  const jobValueThisWeek = dedupRevenue(weekJobValueRes.data ?? []);
  const jobValuePrevWeek = sumNestedRevenue(prevWeekJobValueRes.data ?? []);
  const jobValueDelta = pctDelta(jobValueThisWeek, jobValuePrevWeek);

  const firstName = (user.full_name ?? user.email.split("@")[0]).split(/\s+/)[0];

  // Most relevant visit ID for the Clock In button — first visit of today.
  const firstVisitId = todayVisits[0]?.id as string | undefined;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <h1 className="text-3xl font-extrabold tracking-tight text-[#1a2332] dark:text-white">
        {greeting(today)}, {firstName}
      </h1>

      {/* Let's get started — single-row card with clock-in CTA */}
      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-800">
        <p className="text-base font-bold text-[#1a2332] dark:text-white">
          Let&apos;s get started
        </p>
        {firstVisitId ? (
          <ClockButton visitId={firstVisitId} isOpen={false} />
        ) : (
          <Link
            href="/crew/schedule"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1A7B40] px-4 text-sm font-bold text-white shadow-sm active:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
            Clock In
          </Link>
        )}
      </section>

      {/* Map */}
      {todayVisits.length > 0 ? (
        <CrewHomeMap
          pins={todayVisits.map((v) => {
            const p = Array.isArray(v.project) ? v.project[0] : v.project;
            return {
              id: v.id as string,
              address: (p?.service_address ?? p?.location) as string | null,
            };
          })}
          allAddresses={todayVisits
            .map((v) => {
              const p = Array.isArray(v.project) ? v.project[0] : v.project;
              return (p?.service_address ?? p?.location) as string | null;
            })
            .filter((a): a is string => Boolean(a))}
        />
      ) : (
        <EmptyVisitsCard />
      )}

      {/* This week stats */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#1a2332] dark:text-white">
              This week
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {fmtDateRange(weekStart, weekEnd)}
            </p>
          </div>
          <Link
            href="/crew/timesheet"
            className="text-sm font-semibold text-[#1A7B40]"
          >
            View timesheet
          </Link>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-700">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Total completed time
          </p>
          <p className="text-sm font-bold text-[#1a2332] tabular-nums dark:text-white">
            {formatDuration(totalCompletedMs)}
          </p>
        </div>
      </section>

      {/* To do */}
      <section className="space-y-2">
        <h2 className="text-lg font-extrabold text-[#1a2332] dark:text-white">
          To do
        </h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {todoRows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className="flex items-center gap-3 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
              >
                {row.icon}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                    {row.label}
                  </p>
                  {row.sub && (
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {row.sub}
                    </p>
                  )}
                </div>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-[#1A7B40]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Business health */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#1a2332] dark:text-white">
            Business health
          </h2>
          <Link
            href="/dashboard/reports"
            className="text-sm font-semibold text-[#1A7B40]"
          >
            View all
          </Link>
        </div>
        <BusinessHealthRow
          label="Job value"
          subLabel={`This week (${fmtDateRange(weekStart, weekEnd)})`}
          value={moneyShort(jobValueThisWeek)}
          delta={jobValueDelta}
        />
        <BusinessHealthRow
          label="Visits scheduled"
          subLabel={`This week (${fmtDateRange(weekStart, weekEnd)})`}
          value={String(visitsThisWeekCount)}
          delta={visitsDelta}
        />
      </section>

      <CreateFab />
    </div>
  );
}

function moneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return money(n);
}

function EmptyVisitsCard() {
  return (
    <div className="rounded-2xl bg-neutral-100 p-8 text-center dark:bg-neutral-800">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        No visits scheduled today
      </p>
    </div>
  );
}

function BusinessHealthRow({
  label,
  subLabel,
  value,
  delta,
}: {
  label: string;
  subLabel: string;
  value: string;
  delta: { dir: "up" | "down"; pct: number } | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
      <div>
        <p className="text-sm font-semibold text-[#1a2332] dark:text-white">
          {label}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {subLabel}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-base font-extrabold text-[#1a2332] dark:text-white">
          {value}
        </p>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              delta.dir === "up"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            <span>{delta.dir === "up" ? "↑" : "↓"}</span>
            <span>{delta.pct}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Icon({
  kind,
  tone,
}: {
  kind: "inbox" | "search" | "hammer";
  tone: "gold" | "pink" | "green";
}) {
  const toneColor = {
    gold: "#E8B74A",
    pink: "#D46B7E",
    green: "#1A7B40",
  }[tone];
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={{ background: "transparent", color: toneColor }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {kind === "inbox" && (
          <path d="M3 12V5h18v7M3 12l3 7h12l3-7M3 12h6l1 2h4l1-2h6" />
        )}
        {kind === "search" && (
          <>
            <path d="M7 4h8l4 4v8M5 4h2v16h12v-2" />
            <circle cx="11" cy="11" r="2.5" />
            <path d="M13 13l2 2" />
          </>
        )}
        {kind === "hammer" && (
          <path d="M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z" />
        )}
      </svg>
    </span>
  );
}
