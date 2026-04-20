import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money, dateShort } from "@/lib/format";
import { PageHeader, Card, StatusPillLink } from "@/components/ui";

export const metadata = { title: "Reports — Rose Concrete" };

type Quote = {
  id?: string;
  status?: string;
  accepted_total: number | string | null;
  accepted_at: string | null;
  issued_at: string | null;
  project: {
    service_type: string | null;
    client: { source: string | null } | null;
  } | null;
};

function windowDays(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

/**
 * Reports hub. Four tabs:
 *   - Revenue: by service type + lead source (365d window)
 *   - Conversion: quote → accept funnel (90d + 365d)
 *   - Timesheets: crew hours from visit_time_entries (this week)
 *   - Profitability: top projects by margin (all-time, requires QBO costs)
 *
 * Each tab is a full query block so filters are bookmark-able.
 */

type View = "revenue" | "conversion" | "timesheets" | "profit";

type SearchParams = Promise<{ view?: View }>;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { view } = await searchParams;
  const active: View = (
    ["revenue", "conversion", "timesheets", "profit"] as const
  ).includes(view as View)
    ? (view as View)
    : "revenue";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Revenue, conversion, timesheets, profitability. All windows run in the last 365d unless stated."
        actions={
          <Link
            href="/dashboard/reports/job-estimation"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
          >
            🎯 Job estimation
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/reports/lead-source"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Lead source
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Revenue + conversion rate per channel (web, referral, OpenPhone…).
          </p>
        </Link>
        <Link
          href="/dashboard/reports/timesheets"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Timesheets
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Crew hours from clock in/out entries, with labor-cost estimate.
          </p>
        </Link>
        <Link
          href="/dashboard/reports/aged-receivables"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Aged receivables
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Unpaid milestones bucketed by days past the due date.
          </p>
        </Link>
        <Link
          href="/dashboard/reports/client-balance"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Client balance summary
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Total invoiced / paid / outstanding per client.
          </p>
        </Link>
        <Link
          href="/dashboard/reports/team-productivity"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Team productivity
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Hours + visits + attributed revenue per crew member.
          </p>
        </Link>
        <Link
          href="/dashboard/reports/salesperson-performance"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Salesperson performance
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Quotes sent, conversion rate, and revenue won per salesperson.
          </p>
        </Link>
        <Link
          href="/dashboard/reports/client-reengagement"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Client re-engagement
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Clients with no activity in 90 / 180 / 365 days — ripe for a
            win-back text.
          </p>
        </Link>
        <Link
          href="/dashboard/reports/properties"
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300"
        >
          <p className="text-sm font-semibold text-neutral-900">
            Properties
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Every service location across every client with job counts.
          </p>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusPillLink
          href="/dashboard/reports"
          label="Revenue"
          active={active === "revenue"}
        />
        <StatusPillLink
          href="/dashboard/reports?view=conversion"
          label="Conversion"
          active={active === "conversion"}
        />
        <StatusPillLink
          href="/dashboard/reports?view=timesheets"
          label="Timesheets"
          active={active === "timesheets"}
        />
        <StatusPillLink
          href="/dashboard/reports?view=profit"
          label="Profitability"
          active={active === "profit"}
        />
      </div>

      {active === "revenue" && <RevenueReport />}
      {active === "conversion" && <ConversionReport />}
      {active === "timesheets" && <TimesheetsReport />}
      {active === "profit" && <ProfitReport />}
    </div>
  );
}

// ── Revenue by service / source ─────────────────────────────────────────

async function RevenueReport() {
  const supabase = await createClient();
  const since90 = windowDays(90);
  const since365 = windowDays(365);

  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "accepted_total, accepted_at, issued_at, project:projects(service_type, client:clients(source))",
    )
    .eq("status", "accepted")
    .gte("accepted_at", since365);

  const rows = ((quotes ?? []) as unknown) as Quote[];

  const byService: Record<string, { count: number; total: number }> = {};
  const bySource: Record<string, { count: number; total: number }> = {};
  let total90 = 0;
  let total365 = 0;
  for (const q of rows) {
    const amt = Number(q.accepted_total ?? 0);
    total365 += amt;
    if (q.accepted_at && q.accepted_at >= since90) total90 += amt;

    const project = Array.isArray(q.project) ? q.project[0] : q.project;
    const serviceType = project?.service_type ?? "unspecified";
    const source =
      (project?.client
        ? Array.isArray(project.client)
          ? project.client[0]?.source
          : project.client.source
        : null) ?? "unknown";

    byService[serviceType] ??= { count: 0, total: 0 };
    byService[serviceType].count++;
    byService[serviceType].total += amt;

    bySource[source] ??= { count: 0, total: 0 };
    bySource[source].count++;
    bySource[source].total += amt;
  }

  const { count: openLeads } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  const serviceRows = Object.entries(byService).sort(
    (a, b) => b[1].total - a[1].total,
  );
  const sourceRows = Object.entries(bySource).sort(
    (a, b) => b[1].total - a[1].total,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Accepted · last 90d" value={money(total90)} />
        <StatCard label="Accepted · last 365d" value={money(total365)} />
        <StatCard label="Open leads" value={String(openLeads ?? 0)} />
      </div>
      <ReportTable
        title="Revenue by service type (last 365d)"
        rows={serviceRows}
      />
      <ReportTable
        title="Revenue by lead source (last 365d)"
        rows={sourceRows}
      />
    </div>
  );
}

// ── Conversion funnel ───────────────────────────────────────────────────

async function ConversionReport() {
  const supabase = await createClient();
  const since90 = windowDays(90);
  const since365 = windowDays(365);

  const [q90, q365] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, status, accepted_at, issued_at, accepted_total, base_total")
      .gte("issued_at", since90),
    supabase
      .from("quotes")
      .select("id, status, accepted_at, issued_at, accepted_total, base_total")
      .gte("issued_at", since365),
  ]);

  function stats(rows: Quote[] | null) {
    const sent = rows?.length ?? 0;
    const accepted = (rows ?? []).filter((r) => r.status === "accepted").length;
    const declined = (rows ?? []).filter((r) => r.status === "declined").length;
    const expired = (rows ?? []).filter((r) => r.status === "expired").length;
    const rate = sent > 0 ? (accepted / sent) * 100 : 0;

    let avgDays = 0;
    let dayCount = 0;
    for (const r of rows ?? []) {
      if (!r.accepted_at || !r.issued_at) continue;
      const ms =
        new Date(r.accepted_at).getTime() - new Date(r.issued_at).getTime();
      if (ms > 0) {
        avgDays += ms / (24 * 60 * 60 * 1000);
        dayCount++;
      }
    }
    avgDays = dayCount > 0 ? avgDays / dayCount : 0;

    const avgValue = accepted > 0
      ? (rows ?? [])
          .filter((r) => r.status === "accepted")
          .reduce((sum, r) => sum + Number(r.accepted_total ?? 0), 0) /
        accepted
      : 0;

    return { sent, accepted, declined, expired, rate, avgDays, avgValue };
  }

  const s90 = stats((q90.data as unknown) as Quote[]);
  const s365 = stats((q365.data as unknown) as Quote[]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FunnelCard title="Last 90 days" stats={s90} />
        <FunnelCard title="Last 365 days" stats={s365} />
      </div>
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">
          How to read this
        </h3>
        <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-0.5">
          <li>
            <strong>Acceptance rate</strong> = accepted / sent quotes in the
            window.
          </li>
          <li>
            <strong>Time to close</strong> = average days between{" "}
            <code>issued_at</code> and <code>accepted_at</code>.
          </li>
          <li>
            <strong>Avg accepted value</strong> = mean of{" "}
            <code>accepted_total</code> for quotes that converted.
          </li>
        </ul>
      </Card>
    </div>
  );
}

// ── Timesheets (this week) ──────────────────────────────────────────────

async function TimesheetsReport() {
  const supabase = await createClient();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const { data: entries } = await supabase
    .from("visit_time_entries")
    .select(
      "id, clock_in_at, clock_out_at, user_id, user:profiles(id, full_name, email), visit:visits(id, project:projects(name))",
    )
    .gte("clock_in_at", weekStart.toISOString())
    .order("clock_in_at", { ascending: false });

  type Entry = {
    id: string;
    clock_in_at: string;
    clock_out_at: string | null;
    user_id: string;
    user:
      | {
          id: string;
          full_name: string | null;
          email: string;
        }
      | Array<{ id: string; full_name: string | null; email: string }>
      | null;
    visit:
      | {
          id: string;
          project:
            | { name: string }
            | Array<{ name: string }>
            | null;
        }
      | null;
  };
  const rows = ((entries ?? []) as unknown) as Entry[];

  // Per-user totals
  type UserTotal = { name: string; hours: number; openClocks: number };
  const byUser = new Map<string, UserTotal>();
  for (const r of rows) {
    const u = Array.isArray(r.user) ? r.user[0] : r.user;
    if (!u) continue;
    const key = u.id;
    const existing = byUser.get(key) ?? {
      name: u.full_name ?? u.email,
      hours: 0,
      openClocks: 0,
    };
    if (r.clock_out_at) {
      const ms =
        new Date(r.clock_out_at).getTime() - new Date(r.clock_in_at).getTime();
      existing.hours += ms / (1000 * 60 * 60);
    } else {
      existing.openClocks++;
    }
    byUser.set(key, existing);
  }

  const totalsRows = Array.from(byUser.values()).sort(
    (a, b) => b.hours - a.hours,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Week of{" "}
        {weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
        . GPS-stamped clock-ins from{" "}
        <code>visit_time_entries</code>.
      </p>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Crew</th>
              <th className="px-4 py-2">Open shifts</th>
              <th className="px-4 py-2 text-right">Hours (closed)</th>
            </tr>
          </thead>
          <tbody>
            {totalsRows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-neutral-500"
                >
                  No clock-ins this week yet.
                </td>
              </tr>
            ) : (
              totalsRows.map((u) => (
                <tr
                  key={u.name}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2 text-xs">
                    {u.openClocks > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                        {u.openClocks} open
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {u.hours.toFixed(1)} hrs
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-0">
        <div className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800">
          Individual entries
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Crew</th>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Clock in</th>
              <th className="px-4 py-2">Clock out</th>
              <th className="px-4 py-2 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-neutral-500"
                >
                  No entries.
                </td>
              </tr>
            ) : (
              rows.slice(0, 50).map((r) => {
                const u = Array.isArray(r.user) ? r.user[0] : r.user;
                const v = r.visit;
                const p = v?.project
                  ? Array.isArray(v.project)
                    ? v.project[0]
                    : v.project
                  : null;
                const hours = r.clock_out_at
                  ? (new Date(r.clock_out_at).getTime() -
                      new Date(r.clock_in_at).getTime()) /
                    (1000 * 60 * 60)
                  : 0;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-4 py-2">
                      {u?.full_name ?? u?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2">{p?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {dateShort(r.clock_in_at)}{" "}
                      {new Date(r.clock_in_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-500">
                      {r.clock_out_at
                        ? new Date(r.clock_out_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "— open"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.clock_out_at ? hours.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Profitability ───────────────────────────────────────────────────────

async function ProfitReport() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, revenue_cached, cost_cached, margin_cached, status, client:clients(name)",
    )
    .gt("revenue_cached", 0)
    .order("margin_cached", { ascending: true })
    .limit(50);

  type P = {
    id: string;
    name: string;
    revenue_cached: number | string | null;
    cost_cached: number | string | null;
    margin_cached: number | string | null;
    status: string;
    client: { name: string } | { name: string }[] | null;
  };
  const rows = ((projects ?? []) as unknown) as P[];

  const totalRevenue = rows.reduce(
    (sum, r) => sum + Number(r.revenue_cached ?? 0),
    0,
  );
  const totalCost = rows.reduce(
    (sum, r) => sum + Number(r.cost_cached ?? 0),
    0,
  );
  const totalMargin = totalRevenue - totalCost;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue (tracked)" value={money(totalRevenue)} />
        <StatCard label="Cost (QBO)" value={money(totalCost)} />
        <StatCard
          label="Margin"
          value={money(totalMargin)}
          tone={totalMargin < 0 ? "danger" : "success"}
        />
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800">
          Tightest margins first
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">
            No projects with revenue yet. Job profitability lights up once
            costs are imported from QBO.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Margin</th>
                <th className="px-4 py-2 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const c = Array.isArray(p.client) ? p.client[0] : p.client;
                const rev = Number(p.revenue_cached ?? 0);
                const margin = Number(p.margin_cached ?? 0);
                const pct = rev > 0 ? (margin / rev) * 100 : null;
                return (
                  <tr
                    key={p.id}
                    className="border-t border-neutral-100"
                  >
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {c?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {money(rev)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {money(p.cost_cached)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        margin < 0 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {money(margin)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        pct !== null && pct < 15 ? "text-red-700" : ""
                      }`}
                    >
                      {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-red-200 bg-red-50"
        : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-lg border ${cls} p-4 shadow-sm`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function ReportTable({
  title,
  rows,
}: {
  title: string;
  rows: [string, { count: number; total: number }][];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500">No accepted quotes yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Bucket</th>
              <th className="px-4 py-2">Accepted quotes</th>
              <th className="px-4 py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-800">{k}</td>
                <td className="px-4 py-2 text-neutral-600">{v.count}</td>
                <td className="px-4 py-2 text-right font-semibold text-neutral-900">
                  {money(v.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FunnelCard({
  title,
  stats,
}: {
  title: string;
  stats: {
    sent: number;
    accepted: number;
    declined: number;
    expired: number;
    rate: number;
    avgDays: number;
    avgValue: number;
  };
}) {
  return (
    <Card>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h3>
      <dl className="mt-3 space-y-1 text-sm">
        <Row label="Quotes issued" value={String(stats.sent)} />
        <Row
          label="Accepted"
          value={`${stats.accepted} (${stats.rate.toFixed(1)}%)`}
        />
        <Row label="Declined" value={String(stats.declined)} />
        <Row label="Expired" value={String(stats.expired)} />
        <Row
          label="Avg time to close"
          value={
            stats.avgDays > 0 ? `${stats.avgDays.toFixed(1)} days` : "—"
          }
        />
        <Row
          label="Avg accepted value"
          value={stats.accepted > 0 ? money(stats.avgValue) : "—"}
        />
      </dl>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}
