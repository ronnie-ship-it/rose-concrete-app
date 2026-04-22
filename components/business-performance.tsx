import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { money } from "@/lib/format";

/**
 * Jobber-parity "Business Performance" panel. Four stacked cards in
 * the right column of the dashboard:
 *
 *   Receivables            — "N clients owe you  —  $X"
 *   Upcoming jobs this week — "$X" with progress pill
 *   Revenue this month      — "$X so far"
 *   Upcoming payouts        — (placeholder until Stripe lands)
 *
 * Each card is clickable; drills into a filtered detail view.
 */
export async function BusinessPerformance() {
  const supabase = createServiceRoleClient();
  const now = new Date();

  // Week (Mon–Sun) and month bounds.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartIso = monthStart.toISOString();

  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diffToMon = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // ── Receivables ──
  // Unpaid milestones — overdue + due. We aggregate in JS to avoid
  // a materialized-view dep; payment_milestones row counts are
  // small enough (<10k) that this is fine.
  const { data: unpaid } = await supabase
    .from("payment_milestones")
    .select(
      "amount, total_with_fee, status, schedule:payment_schedules!inner(project:projects!inner(client_id, client:clients(name)))",
    )
    .in("status", ["due", "overdue", "pending"]);

  type Owed = { name: string; balance: number };
  const owedByClient = new Map<string, Owed>();
  let totalReceivables = 0;
  for (const m of unpaid ?? []) {
    const amt = Number(m.total_with_fee ?? m.amount ?? 0);
    totalReceivables += amt;
    const schedule = Array.isArray(m.schedule) ? m.schedule[0] : m.schedule;
    const project = schedule?.project
      ? Array.isArray(schedule.project)
        ? schedule.project[0]
        : schedule.project
      : null;
    const client = project?.client
      ? Array.isArray(project.client)
        ? project.client[0]
        : project.client
      : null;
    const id = (project?.client_id as string | undefined) ?? "unknown";
    const existing = owedByClient.get(id);
    owedByClient.set(id, {
      name: (client?.name as string | null) ?? "Unknown client",
      balance: (existing?.balance ?? 0) + amt,
    });
  }
  const receivableClients = Array.from(owedByClient.values())
    .filter((o) => o.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  // ── Upcoming jobs (this week) ──
  const { data: weekVisits } = await supabase
    .from("visits")
    .select(
      "id, project:projects(id, name, revenue_cached)",
    )
    .gte("scheduled_for", weekStart.toISOString())
    .lt("scheduled_for", weekEnd.toISOString())
    .neq("status", "cancelled");
  let weekRevenue = 0;
  const seenProjects = new Set<string>();
  for (const v of weekVisits ?? []) {
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    if (!p?.id) continue;
    if (seenProjects.has(p.id as string)) continue;
    seenProjects.add(p.id as string);
    weekRevenue += Number(p.revenue_cached ?? 0);
  }

  // ── Revenue this month (paid milestones) ──
  const { data: paidThisMonth } = await supabase
    .from("payment_milestones")
    .select("qbo_paid_amount, amount, total_with_fee, qbo_paid_at")
    .eq("status", "paid")
    .gte("qbo_paid_at", monthStartIso);
  const monthRevenue = (paidThisMonth ?? []).reduce(
    (sum, m) =>
      sum + Number(m.qbo_paid_amount ?? m.total_with_fee ?? m.amount ?? 0),
    0,
  );

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Business performance
      </h2>

      <div className="mt-4 space-y-3">
        {/* Receivables */}
        <Link
          href="/dashboard/payments"
          className="block rounded-md border border-neutral-100 p-3 hover:bg-neutral-50 dark:border-brand-700 dark:hover:bg-brand-900/50"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Receivables
            </p>
            <span className="text-xs text-neutral-400">
              {receivableClients.length}{" "}
              {receivableClients.length === 1 ? "client" : "clients"}
            </span>
          </div>
          <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">
            {money(totalReceivables)}
          </p>
          {receivableClients.slice(0, 3).map((c) => (
            <p
              key={c.name}
              className="mt-0.5 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300"
            >
              <span className="truncate">{c.name}</span>
              <span className="font-semibold">{money(c.balance)}</span>
            </p>
          ))}
        </Link>

        {/* Upcoming jobs this week */}
        <Link
          href="/dashboard/schedule?view=week"
          className="block rounded-md border border-neutral-100 p-3 hover:bg-neutral-50 dark:border-brand-700 dark:hover:bg-brand-900/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Upcoming jobs
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            This week
          </p>
          <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">
            {money(weekRevenue)}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {seenProjects.size}{" "}
            {seenProjects.size === 1 ? "project" : "projects"}
          </p>
        </Link>

        {/* Revenue this month */}
        <Link
          href="/dashboard/reports"
          className="block rounded-md border border-neutral-100 p-3 hover:bg-neutral-50 dark:border-brand-700 dark:hover:bg-brand-900/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Revenue
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            This month so far
          </p>
          <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">
            {money(monthRevenue)}
          </p>
        </Link>

        {/* Upcoming payouts — placeholder until Stripe lands */}
        <div className="rounded-md border border-dashed border-neutral-200 p-3 dark:border-brand-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Upcoming payouts
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Configure Stripe / QBO Payments to see payouts here.
          </p>
        </div>
      </div>
    </section>
  );
}
