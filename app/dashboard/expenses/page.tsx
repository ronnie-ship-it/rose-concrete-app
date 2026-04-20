import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader,
  Card,
  EmptyState,
  StatusPillLink,
} from "@/components/ui";
import { money, dateShort } from "@/lib/format";
import { ExpenseForm } from "./expense-form";
import { DeleteExpenseButton } from "./delete-button";

export const metadata = { title: "Expenses — Rose Concrete" };

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "materials", label: "Materials" },
  { key: "concrete", label: "Concrete" },
  { key: "rebar", label: "Rebar" },
  { key: "equipment_rental", label: "Equipment rental" },
  { key: "subcontractor", label: "Subcontractor" },
  { key: "fuel", label: "Fuel" },
  { key: "permit_fee", label: "Permit fee" },
  { key: "labor", label: "Labor" },
  { key: "other", label: "Other" },
];

type SearchParams = Promise<{ category?: string; project?: string }>;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { category, project } = await searchParams;
  const activeCategory = category && category !== "all" ? category : null;

  const supabase = await createClient();

  let builder = supabase
    .from("expenses")
    .select(
      "id, project_id, vendor, category, amount, note, expense_date, paid_from, created_at, project:projects(id, name, client:clients(name))",
    )
    .order("expense_date", { ascending: false })
    .limit(500);
  if (activeCategory) builder = builder.eq("category", activeCategory);
  if (project) builder = builder.eq("project_id", project);

  const [{ data: rows }, { data: projects }, summaryRes] = await Promise.all([
    builder,
    supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("expenses")
      .select("amount, expense_date, category"),
  ]);

  type Row = {
    id: string;
    project_id: string | null;
    vendor: string | null;
    category: string;
    amount: number | string;
    note: string | null;
    expense_date: string;
    paid_from: string | null;
    created_at: string;
    project:
      | { id: string; name: string; client: { name: string } | { name: string }[] | null }
      | { id: string; name: string; client: unknown }[]
      | null;
  };
  const expenses = (rows ?? []) as unknown as Row[];
  const projectOptions = (projects ?? []) as Array<{ id: string; name: string }>;

  // Summary strip: total this month / last 30d / total this year
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const thirtyDaysAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const yearPrefix = String(now.getFullYear());
  let mtd = 0;
  let last30 = 0;
  let ytd = 0;
  for (const r of (summaryRes.data ?? []) as Array<{
    amount: number | string;
    expense_date: string;
  }>) {
    const amt = Number(r.amount ?? 0);
    if (r.expense_date?.startsWith(thisMonth)) mtd += amt;
    if (r.expense_date && r.expense_date >= thirtyDaysAgoIso.slice(0, 10))
      last30 += amt;
    if (r.expense_date?.startsWith(yearPrefix)) ytd += amt;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track materials, subs, permits, fuel — per-project costs that drive job margin."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="This month" value={money(mtd)} />
        <SummaryCard label="Last 30 days" value={money(last30)} />
        <SummaryCard label={`${yearPrefix} YTD`} value={money(ytd)} />
      </div>

      <ExpenseForm projects={projectOptions} />

      <div className="flex flex-wrap gap-1.5 overflow-x-auto">
        {CATEGORIES.map((c) => {
          const href =
            c.key === "all"
              ? "/dashboard/expenses"
              : `/dashboard/expenses?category=${c.key}`;
          const active =
            c.key === "all" ? !activeCategory : activeCategory === c.key;
          return (
            <StatusPillLink
              key={c.key}
              href={href}
              label={c.label}
              active={active}
            />
          );
        })}
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses logged"
          description="Add one above — the summary and job margin update as soon as it saves."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Paid from</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((r) => {
                const p = Array.isArray(r.project) ? r.project[0] : r.project;
                const c = p
                  ? Array.isArray(p.client)
                    ? (p.client as Array<{ name: string }>)[0]
                    : (p.client as { name: string } | null)
                  : null;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-4 py-2 text-neutral-700">
                      {dateShort(r.expense_date)}
                    </td>
                    <td className="px-4 py-2">
                      {r.vendor ?? "—"}
                      {r.note && (
                        <p className="text-[11px] text-neutral-500">
                          {r.note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs capitalize">
                      {r.category.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2">
                      {p ? (
                        <a
                          href={`/dashboard/projects/${p.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {p.name}
                        </a>
                      ) : (
                        <span className="text-neutral-400">Unassigned</span>
                      )}
                      {c?.name && (
                        <p className="text-[11px] text-neutral-500">{c.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-neutral-600 capitalize">
                      {r.paid_from ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-neutral-900">
                      {money(r.amount)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeleteExpenseButton id={r.id} />
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
