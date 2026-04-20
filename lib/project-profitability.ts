/**
 * Breaks a project's cost into Line items / Labour / Expenses for the
 * Job Profitability donut on the project detail page.
 *
 * Jobber splits cost the same three ways. We don't have a strict
 * "cost source" flag on job_costs, so we bucket by keyword match on
 * the free-form `category` column. Anything that mentions labor,
 * payroll, wages, crew, or sub goes to Labour; anything mentioning
 * materials, supplies, line items, concrete, or equipment goes to
 * Line items; the rest lands in Expenses.
 *
 * If Ronnie doesn't use categories at all, cost collapses into
 * Expenses — the donut still renders, just with one cost slice.
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

export type ProfitabilityBreakdown = {
  /** Revenue = accepted quote total (or sum of milestone amounts
   *  if no accepted quote). Matches `projects.revenue_cached`. */
  revenue: number;
  /** Internal cost of line-item materials/supplies. */
  lineItems: number;
  /** Labor (crew wages, subs). */
  labour: number;
  /** Other expenses not bucketed as labour or line items. */
  expenses: number;
  /** Revenue minus the three cost buckets. */
  profit: number;
  /** profit / revenue, or null when revenue is 0. */
  marginPct: number | null;
  /** Count of source job_cost rows — handy for the "N transactions"
   *  tooltip next to each slice. */
  costRowCount: number;
};

const LABOUR_KEYWORDS = [
  "labor",
  "labour",
  "wage",
  "payroll",
  "crew",
  "subcontract",
  "1099",
  "w2",
  "wages",
];

const LINE_ITEM_KEYWORDS = [
  "material",
  "supplies",
  "concrete",
  "rebar",
  "lumber",
  "equipment",
  "rental",
  "line item",
  "product",
];

function bucketFor(
  category: string | null,
  memo: string | null,
): "labour" | "lineItems" | "expenses" {
  const hay = [(category ?? "").toLowerCase(), (memo ?? "").toLowerCase()].join(
    " ",
  );
  if (LABOUR_KEYWORDS.some((k) => hay.includes(k))) return "labour";
  if (LINE_ITEM_KEYWORDS.some((k) => hay.includes(k))) return "lineItems";
  return "expenses";
}

export async function loadProjectProfitability(
  projectId: string,
): Promise<ProfitabilityBreakdown> {
  const supabase = createServiceRoleClient();
  const [{ data: proj }, { data: costs }] = await Promise.all([
    supabase
      .from("projects")
      .select("revenue_cached, cost_cached, margin_cached")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("job_costs")
      .select("amount, category, memo")
      .eq("project_id", projectId),
  ]);

  let revenue = Number(proj?.revenue_cached ?? 0);
  // If revenue_cached hasn't been computed yet, fall back to the
  // active payment schedule's total (so the donut isn't always empty
  // on new projects).
  if (revenue === 0) {
    const { data: sched } = await supabase
      .from("payment_schedules")
      .select("total_amount")
      .eq("project_id", projectId)
      .maybeSingle();
    if (sched) revenue = Number(sched.total_amount ?? 0);
  }

  let lineItems = 0;
  let labour = 0;
  let expenses = 0;
  for (const c of costs ?? []) {
    const amt = Number(c.amount ?? 0);
    const b = bucketFor(
      (c.category as string | null) ?? null,
      (c.memo as string | null) ?? null,
    );
    if (b === "labour") labour += amt;
    else if (b === "lineItems") lineItems += amt;
    else expenses += amt;
  }

  const totalCost = lineItems + labour + expenses;
  const profit = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
  return {
    revenue,
    lineItems,
    labour,
    expenses,
    profit,
    marginPct,
    costRowCount: (costs ?? []).length,
  };
}
