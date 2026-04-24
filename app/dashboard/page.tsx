import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { ActiveChecklistsWidget } from "@/components/active-checklists-widget";
import { BusinessPerformance } from "@/components/business-performance";
import { HighlightedCard } from "@/components/highlighted-card";
import { TodaysAppointments } from "@/components/todays-appointments";

type SearchParams = Promise<{ appts?: string }>;

/**
 * Jobber-parity dashboard home (`/dashboard`).
 *
 *   ┌ Tuesday, April 21 ─────────────────────────────────── │ Highlighted │
 *   │ Good evening, Thomas                                    │             │
 *   │                                                         │ Business    │
 *   │ Workflow                                                │ Performance │
 *   │ ┌────┬────┬────┬────┐                                   │             │
 *   │ │Req │Quo │Job │Inv │                                   │             │
 *   │ │ 50 │ 31 │ 42 │  0 │                                   │             │
 *   │ │ …  │ …  │ …  │ …  │                                   │             │
 *   │ └────┴────┴────┴────┘                                   │             │
 *   │                                                         │             │
 *   │ Today's appointments                                    │             │
 *   │ ┌─────────────────────────────────────────────────┐     │             │
 *   │ │ Total Active Completed Overdue Remaining  [btn] │     │             │
 *   │ │ (Visit | Employee)                               │     │             │
 *   │ │ 1 OVERDUE …                                      │     │             │
 *   │ │ 1 ACTIVE …                                       │     │             │
 *   │ └─────────────────────────────────────────────────┘     │             │
 *   └─────────────────────────────────────────────────────────┴─────────────┘
 *
 * Layout: three-column grid on ≥lg (left = workflow + today's, right =
 * highlighted + business performance); single-column stack on mobile.
 */
export default async function DashboardHome({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const sp = await searchParams;
  const apptView: "visit" | "employee" = sp.appts === "employee" ? "employee" : "visit";

  const now = new Date();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // 12 parallel queries to populate the 4 workflow cards.
  const [
    requestsNew,
    requestsOverdue,
    requestsAssessments,
    quotesDraft,
    quotesApproved,
    quotesChanges,
    quotesAwaiting,
    projectsActive,
    projectsRequireInvoicing,
    projectsActionRequired,
    invoicesDraft,
    invoicesAwaiting,
    invoicesPastDue,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .lt("captured_at", fortyEightHoursAgo),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "qualified"),
    supabase
      .from("quotes")
      .select("id, base_total, optional_total, accepted_total")
      .eq("status", "draft"),
    supabase
      .from("quotes")
      .select("id, accepted_total, base_total")
      .eq("status", "accepted"),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "declined"),
    supabase
      .from("quotes")
      .select("id, base_total, optional_total, accepted_total")
      .eq("status", "sent"),
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
      .lt("scheduled_start", weekAgo),
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
  ]);

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
  const sumMilestone = (
    rows: Array<{ amount?: number | string | null; total_with_fee?: number | string | null }>,
  ) => rows.reduce((s, r) => s + Number(r.total_with_fee ?? r.amount ?? 0), 0);
  const sumRevenue = (rows: Array<{ revenue_cached?: number | string | null }>) =>
    rows.reduce((s, r) => s + Number(r.revenue_cached ?? 0), 0);

  const pipe = {
    requests: {
      newCount: requestsNew.count ?? 0,
      overdueCount: requestsOverdue.count ?? 0,
      assessmentsComplete: requestsAssessments.count ?? 0,
    },
    quotes: {
      draftCount: (quotesDraft.data ?? []).length,
      draftValue: sumQuoteValue(quotesDraft.data ?? []),
      awaitingCount: (quotesAwaiting.data ?? []).length,
      awaitingValue: sumQuoteValue(quotesAwaiting.data ?? []),
      approvedCount: (quotesApproved.data ?? []).length,
      approvedValue: sumQuoteValue(quotesApproved.data ?? []),
      changesCount: quotesChanges.count ?? 0,
    },
    jobs: {
      activeCount: (projectsActive.data ?? []).length,
      activeValue: sumRevenue(projectsActive.data ?? []),
      requireInvoicingCount: (projectsRequireInvoicing.data ?? []).length,
      requireInvoicingValue: sumRevenue(projectsRequireInvoicing.data ?? []),
      actionRequiredCount: (projectsActionRequired.data ?? []).length,
      actionRequiredValue: sumRevenue(projectsActionRequired.data ?? []),
    },
    invoices: {
      awaitingCount: (invoicesAwaiting.data ?? []).length,
      awaitingValue: sumMilestone(invoicesAwaiting.data ?? []),
      draftCount: (invoicesDraft.data ?? []).length,
      draftValue: sumMilestone(invoicesDraft.data ?? []),
      pastDueCount: (invoicesPastDue.data ?? []).length,
      pastDueValue: sumMilestone(invoicesPastDue.data ?? []),
    },
  };

  const firstName = (user.full_name ?? user.email.split("@")[0]).split(/\s+/)[0];
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* LEFT COLUMN */}
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-sm text-neutral-500 dark:text-jobber-text-2">
            {dateLabel}
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {greeting(now)}, {firstName}
          </h1>
        </header>

        {/* Workflow strip */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-neutral-900 dark:text-white">
            Workflow
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <WorkflowCard
              accent="gold"
              icon="📥"
              title="Requests"
              headline={String(pipe.requests.newCount)}
              label="New"
              href="/dashboard/requests?status=new"
              subs={[
                {
                  label: `Assessments complete (${pipe.requests.assessmentsComplete})`,
                  value: "",
                  href: "/dashboard/requests?status=qualified",
                },
                {
                  label: `Overdue (${pipe.requests.overdueCount})`,
                  value: "",
                  href: "/dashboard/requests?status=overdue",
                },
              ]}
            />
            <WorkflowCard
              accent="pink"
              icon="🔍"
              title="Quotes"
              headline={String(pipe.quotes.approvedCount)}
              headlineSub={money(pipe.quotes.approvedValue)}
              label="Approved"
              href="/dashboard/quotes?status=accepted"
              subs={[
                {
                  label: `Draft (${pipe.quotes.draftCount})`,
                  value: money(pipe.quotes.draftValue),
                  href: "/dashboard/quotes?status=draft",
                },
                {
                  label: `Changes requested (${pipe.quotes.changesCount})`,
                  value: "",
                  href: "/dashboard/quotes?status=declined",
                },
              ]}
            />
            <WorkflowCard
              accent="green"
              icon="🔨"
              title="Jobs"
              headline={String(pipe.jobs.requireInvoicingCount)}
              headlineSub={money(pipe.jobs.requireInvoicingValue)}
              label="Requires invoicing"
              href="/dashboard/projects?status=done"
              subs={[
                {
                  label: `Active (${pipe.jobs.activeCount})`,
                  value: money(pipe.jobs.activeValue),
                  href: "/dashboard/projects?status=active",
                },
                {
                  label: `Action required (${pipe.jobs.actionRequiredCount})`,
                  value: money(pipe.jobs.actionRequiredValue),
                  href: "/dashboard/projects?status=scheduled",
                },
              ]}
            />
            <WorkflowCard
              accent="cyan"
              icon="💲"
              title="Invoices"
              headline={String(pipe.invoices.awaitingCount)}
              headlineSub={money(pipe.invoices.awaitingValue)}
              label="Awaiting payment"
              href="/dashboard/payments"
              subs={[
                {
                  label: `Draft (${pipe.invoices.draftCount})`,
                  value: money(pipe.invoices.draftValue),
                  href: "/dashboard/payments?status=draft",
                },
                {
                  label: `Past due (${pipe.invoices.pastDueCount})`,
                  value: money(pipe.invoices.pastDueValue),
                  href: "/dashboard/payments?status=overdue",
                },
              ]}
            />
          </div>
        </section>

        <TodaysAppointments view={apptView} />

        <ActiveChecklistsWidget />
      </div>

      {/* RIGHT RAIL */}
      <aside className="space-y-4">
        <HighlightedCard
          storageKey="gmail-connect-v1"
          title="Connect Gmail to auto-attach photos"
          body="Estimator/crew emails with photos are automatically attached to the matching project. 5 min to set up."
          ctaLabel="Connect Gmail"
          ctaHref="/dashboard/settings/gmail-watch"
        />
        <BusinessPerformance />
      </aside>
    </div>
  );
}

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const WF_ACCENT: Record<"gold" | "pink" | "green" | "cyan", string> = {
  gold: "#E8B74A",
  pink: "#D46B7E",
  green: "#8FBF4A",
  cyan: "#4FA8E0",
};

function WorkflowCard({
  accent,
  icon,
  title,
  headline,
  headlineSub,
  label,
  href,
  subs,
}: {
  accent: keyof typeof WF_ACCENT;
  icon: string;
  title: string;
  headline: string;
  headlineSub?: string;
  label: string;
  href: string;
  subs: { label: string; value: string; href?: string }[];
}) {
  const color = WF_ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white pt-1 shadow-sm transition hover:border-neutral-300 dark:border-jobber-line dark:bg-jobber-card">
      {/* 4px colored top strip */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: color }}
      />
      <div className="p-4">
        <Link
          href={href}
          className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-jobber-text-2"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="text-sm leading-none">{icon}</span>
            <span>{title}</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        <div className="mt-3 flex items-baseline gap-2">
          <Link
            href={href}
            className="text-4xl font-extrabold text-neutral-900 hover:underline dark:text-white"
          >
            {headline}
          </Link>
          {headlineSub && (
            <span className="text-xs font-semibold text-neutral-500 dark:text-jobber-text-2">
              {headlineSub}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-bold text-neutral-900 dark:text-white">
          {label}
        </p>
        <ul className="mt-3 space-y-1">
          {subs.map((s) => {
            const inner = (
              <span className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-neutral-600 dark:text-jobber-text-2">
                  {s.label}
                </span>
                {s.value && (
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {s.value}
                  </span>
                )}
              </span>
            );
            return (
              <li key={s.label}>
                {s.href ? (
                  <Link
                    href={s.href}
                    className="block rounded px-1 hover:bg-neutral-50 dark:hover:bg-white/5"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
