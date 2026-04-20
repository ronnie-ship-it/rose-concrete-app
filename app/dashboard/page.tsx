import Link from "next/link";
import { startOfWeek, endOfWeek, subDays, formatISO } from "date-fns";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { money } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import { MarketingLeadsWidget } from "@/components/marketing-leads-widget";

export default async function DashboardHome() {
  const user = await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const now = new Date();

  const weekStart = formatISO(startOfWeek(now, { weekStartsOn: 1 }), {
    representation: "date",
  });
  const weekEnd = formatISO(endOfWeek(now, { weekStartsOn: 1 }), {
    representation: "date",
  });
  const sevenDaysAgo = formatISO(subDays(now, 7), {
    representation: "date",
  });

  const todayStart = formatISO(now, { representation: "date" });
  const todayEnd = `${todayStart}T23:59:59`;

  // Jobber's 4-card summary: Requests / Quotes / Jobs / Invoices with $
  // totals and 2 sub-rows each. We pull the numbers we need to render all
  // 12 cells in one Promise.all so the dashboard render stays fast.
  const [
    requestsNew,
    requestsOverdue,
    quotesDraft,
    quotesApproved,
    quotesChangesRequested,
    quotesAwaiting,
    projectsActive,
    projectsRequireInvoicing,
    projectsActionRequired,
    invoicesDraft,
    invoicesAwaiting,
    invoicesPastDue,
    activeRes,
    quotesRes,
    visitsRes,
    leadsRes,
    topProjectsRes,
    todayVisitsRes,
    unpaidRes,
    recentMessagesRes,
  ] = await Promise.all([
    // Requests
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .lt(
        "captured_at",
        new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      ),
    // Quotes
    supabase
      .from("quotes")
      .select("id, base_total, optional_total, accepted_total")
      .eq("status", "draft"),
    supabase
      .from("quotes")
      .select("id, accepted_total, base_total")
      .eq("status", "accepted"),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "declined"),
    supabase
      .from("quotes")
      .select("id, base_total, optional_total, accepted_total")
      .eq("status", "sent"),
    // Projects (Jobber "Jobs")
    supabase
      .from("projects")
      .select("id, revenue_cached")
      .in("status", ["approved", "scheduled", "active"]),
    supabase
      .from("projects")
      .select("id, revenue_cached")
      .eq("status", "done")
      .is("invoice_scheduled_for", null),
    supabase
      .from("projects")
      .select("id, revenue_cached")
      .in("status", ["scheduled", "active"])
      .lt(
        "scheduled_start",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    // Invoices (= payment_milestones in our schema)
    supabase
      .from("payment_milestones")
      .select("id, amount, total_with_fee")
      .eq("status", "pending"),
    supabase
      .from("payment_milestones")
      .select("id, amount, total_with_fee")
      .in("status", ["due", "sent"]),
    supabase
      .from("payment_milestones")
      .select("id, amount, total_with_fee")
      .eq("status", "overdue"),
    // Existing widgets below
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "scheduled", "active"]),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "sent"]),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_for", `${weekStart}T00:00:00`)
      .lte("scheduled_for", `${weekEnd}T23:59:59`),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("captured_at", `${sevenDaysAgo}T00:00:00`),
    supabase
      .from("projects")
      .select(
        "id, name, revenue_cached, cost_cached, margin_cached, client:clients(name)"
      )
      .gt("revenue_cached", 0)
      .order("margin_cached", { ascending: true })
      .limit(5),
    // Today's jobs widget
    supabase
      .from("visits")
      .select(
        "id, scheduled_for, status, project:projects(id, name, client:clients(name))"
      )
      .gte("scheduled_for", `${todayStart}T00:00:00`)
      .lte("scheduled_for", todayEnd)
      .order("scheduled_for", { ascending: true })
      .limit(10),
    // Unpaid invoices widget. Column names: `label` (not title),
    // `due_date` (not due_at). Status enum is
    // pending|due|overdue|paid|waived|refunded. Client is reached via
    // schedule → project → client.
    supabase
      .from("payment_milestones")
      .select(
        "id, label, amount, due_date, status, schedule:payment_schedules(project:projects(id, name, client:clients(name)))"
      )
      .in("status", ["pending", "due", "overdue"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    // Recent messages widget. Skip `subject` column — arrives with migration
    // 018 (email support); the widget shows `body` regardless.
    supabase
      .from("communications")
      .select(
        "id, direction, channel, body, started_at, read_at, client:clients(id, name)"
      )
      .order("started_at", { ascending: false })
      .limit(6),
  ]);

  const showMargin = await isFeatureEnabled("qbo_job_costing");

  const topProjects = (topProjectsRes.data ?? []).map((p) => {
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    return { ...p, clientName: client?.name ?? "" };
  });

  // Sum helpers for the pipeline summary card values.
  const sumQuoteValue = (
    rows: Array<{
      accepted_total?: number | string | null;
      base_total?: number | string | null;
      optional_total?: number | string | null;
    }>,
  ) =>
    rows.reduce((sum, r) => {
      if (r.accepted_total != null) return sum + Number(r.accepted_total);
      return sum + Number(r.base_total ?? 0) + Number(r.optional_total ?? 0);
    }, 0);
  const sumMilestoneValue = (
    rows: Array<{
      amount?: number | string | null;
      total_with_fee?: number | string | null;
    }>,
  ) =>
    rows.reduce(
      (sum, r) => sum + Number(r.total_with_fee ?? r.amount ?? 0),
      0,
    );
  const sumRevenue = (rows: Array<{ revenue_cached?: number | string | null }>) =>
    rows.reduce((sum, r) => sum + Number(r.revenue_cached ?? 0), 0);

  const pipeline = {
    requests: {
      newCount: requestsNew.count ?? 0,
      overdueCount: requestsOverdue.count ?? 0,
    },
    quotes: {
      draftCount: (quotesDraft.data ?? []).length,
      draftValue: sumQuoteValue(quotesDraft.data ?? []),
      awaitingCount: (quotesAwaiting.data ?? []).length,
      awaitingValue: sumQuoteValue(quotesAwaiting.data ?? []),
      approvedCount: (quotesApproved.data ?? []).length,
      approvedValue: sumQuoteValue(quotesApproved.data ?? []),
      changesRequestedCount: quotesChangesRequested.count ?? 0,
    },
    projects: {
      activeCount: (projectsActive.data ?? []).length,
      activeValue: sumRevenue(projectsActive.data ?? []),
      requiresInvoicingCount: (projectsRequireInvoicing.data ?? []).length,
      requiresInvoicingValue: sumRevenue(projectsRequireInvoicing.data ?? []),
      actionRequiredCount: (projectsActionRequired.data ?? []).length,
      actionRequiredValue: sumRevenue(projectsActionRequired.data ?? []),
    },
    invoices: {
      awaitingCount: (invoicesAwaiting.data ?? []).length,
      awaitingValue: sumMilestoneValue(invoicesAwaiting.data ?? []),
      draftCount: (invoicesDraft.data ?? []).length,
      draftValue: sumMilestoneValue(invoicesDraft.data ?? []),
      pastDueCount: (invoicesPastDue.data ?? []).length,
      pastDueValue: sumMilestoneValue(invoicesPastDue.data ?? []),
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user.full_name ?? user.email}`}
        subtitle="Rose Concrete operations dashboard"
      />

      {/* Jobber-style 4-card pipeline summary — headline count + $, two sub-rows */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PipelineCard
          accent="amber"
          title="Requests"
          headline={`${pipeline.requests.newCount} new`}
          headlineHref="/dashboard/requests?status=new"
          subs={[
            {
              label: "Overdue (>48h)",
              value: String(pipeline.requests.overdueCount),
              href: "/dashboard/requests?status=overdue",
            },
          ]}
        />
        <PipelineCard
          accent="fuchsia"
          title="Quotes"
          headline={`${pipeline.quotes.approvedCount} approved`}
          headlineSub={money(pipeline.quotes.approvedValue)}
          headlineHref="/dashboard/quotes?status=accepted"
          subs={[
            {
              label: `Draft (${pipeline.quotes.draftCount})`,
              value: money(pipeline.quotes.draftValue),
              href: "/dashboard/quotes?status=draft",
            },
            {
              label: `Awaiting response (${pipeline.quotes.awaitingCount})`,
              value: money(pipeline.quotes.awaitingValue),
              href: "/dashboard/quotes?status=sent",
            },
          ]}
        />
        <PipelineCard
          accent="emerald"
          title="Jobs"
          headline={`${pipeline.projects.requiresInvoicingCount} require invoicing`}
          headlineSub={money(pipeline.projects.requiresInvoicingValue)}
          headlineHref="/dashboard/projects?status=done"
          subs={[
            {
              label: `Active (${pipeline.projects.activeCount})`,
              value: money(pipeline.projects.activeValue),
              href: "/dashboard/projects?status=active",
            },
            {
              label: `Action required (${pipeline.projects.actionRequiredCount})`,
              value: money(pipeline.projects.actionRequiredValue),
              href: "/dashboard/projects?status=scheduled",
            },
          ]}
        />
        <PipelineCard
          accent="sky"
          title="Invoices"
          headline={`${pipeline.invoices.awaitingCount} awaiting payment`}
          headlineSub={money(pipeline.invoices.awaitingValue)}
          headlineHref="/dashboard/payments"
          subs={[
            {
              label: `Draft (${pipeline.invoices.draftCount})`,
              value: money(pipeline.invoices.draftValue),
              href: "/dashboard/payments",
            },
            {
              label: `Past due (${pipeline.invoices.pastDueCount})`,
              value: money(pipeline.invoices.pastDueValue),
              href: "/dashboard/payments?status=overdue",
            },
          ]}
        />
      </div>

      {/* Secondary stat strip — original "this week" cards stay; they
          answer slightly different questions than the pipeline summary. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active jobs"
          value={String(activeRes.count ?? 0)}
          href="/dashboard/projects?status=active"
        />
        <StatCard
          title="Open quotes"
          value={String(quotesRes.count ?? 0)}
          href="/dashboard/quotes"
        />
        <StatCard
          title="This week's visits"
          value={String(visitsRes.count ?? 0)}
          href="/dashboard/schedule"
        />
        <StatCard
          title="New leads (7d)"
          value={String(leadsRes.count ?? 0)}
          href="/dashboard/requests?status=new"
        />
      </div>

      {/* Marketing-site lead attribution — KPIs + per-page volume bar chart. */}
      <MarketingLeadsWidget />

      <div className="grid gap-4 lg:grid-cols-3">
        <Widget title="Today's jobs" href="/dashboard/schedule?view=day">
          {(todayVisitsRes.data ?? []).length === 0 ? (
            <EmptyMini label="Nothing scheduled today." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(todayVisitsRes.data ?? []).map((v) => {
                const p = Array.isArray(v.project) ? v.project[0] : v.project;
                const c = p
                  ? Array.isArray(p.client)
                    ? p.client[0]
                    : p.client
                  : null;
                return (
                  <li key={v.id} className="px-3 py-2 text-xs">
                    <p className="font-semibold text-neutral-900">
                      {new Date(v.scheduled_for).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {p?.name ?? "—"}
                    </p>
                    <p className="text-neutral-600">{c?.name ?? ""}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        <Widget title="Unpaid invoices" href="/dashboard/payments">
          {(unpaidRes.data ?? []).length === 0 ? (
            <EmptyMini label="Everything's paid." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(unpaidRes.data ?? []).map((m) => {
                const sched = Array.isArray(m.schedule)
                  ? m.schedule[0]
                  : m.schedule;
                const p = sched
                  ? Array.isArray(sched.project)
                    ? sched.project[0]
                    : sched.project
                  : null;
                const c = p
                  ? Array.isArray(p.client)
                    ? p.client[0]
                    : p.client
                  : null;
                return (
                  <li key={m.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {c?.name ?? "—"}
                      </p>
                      <p className="text-neutral-600">{m.label}</p>
                    </div>
                    <p className="font-semibold text-neutral-900">{money(m.amount)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        <Widget title="Recent messages" href="/dashboard/messages">
          {(recentMessagesRes.data ?? []).length === 0 ? (
            <EmptyMini label="No messages." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(recentMessagesRes.data ?? []).map((m) => {
                const c = Array.isArray(m.client) ? m.client[0] : m.client;
                return (
                  <li key={m.id} className="px-3 py-2 text-xs">
                    <p className="font-semibold text-neutral-900">
                      {c?.name ?? "Unknown"}
                      {!m.read_at && m.direction === "inbound" && (
                        <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-600 align-middle" />
                      )}
                    </p>
                    <p className="line-clamp-1 text-neutral-600">
                      {m.direction === "outbound" ? "You: " : ""}
                      {m.body ?? "—"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>
      </div>

      {showMargin && topProjects.length > 0 && (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Job profitability snapshot
            </h2>
            <Link
              href="/dashboard/projects"
              className="text-xs text-neutral-500 hover:underline"
            >
              All jobs →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-6 py-2">Project</th>
                <th className="px-6 py-2">Client</th>
                <th className="px-6 py-2 text-right">Revenue</th>
                <th className="px-6 py-2 text-right">Cost</th>
                <th className="px-6 py-2 text-right">Margin</th>
                <th className="px-6 py-2 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {topProjects.map((p) => {
                const rev = Number(p.revenue_cached ?? 0);
                const margin = Number(p.margin_cached ?? 0);
                const pct = rev > 0 ? (margin / rev) * 100 : null;
                return (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-6 py-2 font-medium text-neutral-900">
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-2 text-neutral-600">
                      {p.clientName || "—"}
                    </td>
                    <td className="px-6 py-2 text-right text-neutral-700">
                      {money(p.revenue_cached)}
                    </td>
                    <td className="px-6 py-2 text-right text-neutral-700">
                      {money(p.cost_cached)}
                    </td>
                    <td
                      className={`px-6 py-2 text-right font-medium ${
                        margin < 0 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {money(p.margin_cached)}
                    </td>
                    <td
                      className={`px-6 py-2 text-right ${
                        pct !== null && pct < 15
                          ? "text-red-700"
                          : "text-neutral-700"
                      }`}
                    >
                      {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Widget({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </h3>
        {href && (
          <Link
            href={href}
            className="text-[11px] text-neutral-500 hover:underline"
          >
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <p className="px-3 py-5 text-center text-xs text-neutral-500">{label}</p>
  );
}

const ACCENT: Record<string, string> = {
  amber: "border-amber-200 bg-amber-50",
  fuchsia: "border-fuchsia-200 bg-fuchsia-50",
  emerald: "border-emerald-200 bg-emerald-50",
  sky: "border-sky-200 bg-sky-50",
};
const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  fuchsia: "bg-fuchsia-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
};

function PipelineCard({
  accent,
  title,
  headline,
  headlineSub,
  headlineHref,
  subs,
}: {
  accent: keyof typeof ACCENT;
  title: string;
  headline: string;
  headlineSub?: string;
  headlineHref: string;
  subs: { label: string; value: string; href?: string }[];
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${ACCENT[accent]} p-4 shadow-sm`}
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${ACCENT_DOT[accent]}`} />
      <div className="pl-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {title}
        </p>
        <Link
          href={headlineHref}
          className="mt-1 block text-lg font-bold text-neutral-900 hover:underline"
        >
          {headline}
        </Link>
        {headlineSub && (
          <p className="text-sm font-semibold text-neutral-700">
            {headlineSub}
          </p>
        )}
        <ul className="mt-3 space-y-1">
          {subs.map((s) => {
            const row = (
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="text-neutral-600">{s.label}</span>
                <span className="font-medium text-neutral-900">{s.value}</span>
              </span>
            );
            return (
              <li key={s.label}>
                {s.href ? (
                  <Link href={s.href} className="block hover:underline">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
