import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money, dateShort } from "@/lib/format";

export const metadata = { title: "Aged receivables — Rose Concrete" };

/**
 * Aged receivables report — `payment_milestones` with status in
 * (pending/due/overdue), bucketed by how far past their due_date they are.
 * Mirrors Jobber's "Aged Receivables" canned report.
 */

type Row = {
  id: string;
  amount: number | string;
  total_with_fee: number | string | null;
  due_date: string | null;
  status: string;
  label: string;
  schedule:
    | {
        project:
          | {
              id: string;
              name: string;
              client:
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null;
            }
          | {
              id: string;
              name: string;
              client:
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null;
            }[]
          | null;
      }
    | null;
};

function daysLate(due: string | null): number {
  if (!due) return 0;
  const d = new Date(due + "T00:00:00").getTime();
  if (Number.isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d) / (24 * 60 * 60 * 1000)));
}

function bucket(days: number): "current" | "1_30" | "31_60" | "61_90" | "90_plus" {
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export default async function AgedReceivablesPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_milestones")
    .select(
      "id, amount, total_with_fee, due_date, status, label, schedule:payment_schedules(project:projects(id, name, client:clients(id, name)))",
    )
    .in("status", ["pending", "due", "overdue"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  const rows = (data ?? []) as unknown as Row[];

  const buckets: Record<
    "current" | "1_30" | "31_60" | "61_90" | "90_plus",
    { total: number; rows: Array<Row & { days: number }> }
  > = {
    current: { total: 0, rows: [] },
    "1_30": { total: 0, rows: [] },
    "31_60": { total: 0, rows: [] },
    "61_90": { total: 0, rows: [] },
    "90_plus": { total: 0, rows: [] },
  };
  for (const r of rows) {
    const days = daysLate(r.due_date);
    const amt = Number(r.total_with_fee ?? r.amount ?? 0);
    const b = bucket(days);
    buckets[b].total += amt;
    buckets[b].rows.push({ ...r, days });
  }
  const grand = Object.values(buckets).reduce((s, b) => s + b.total, 0);

  const cols: Array<{
    key: keyof typeof buckets;
    label: string;
    tone: string;
  }> = [
    { key: "current", label: "Current / future", tone: "text-neutral-900" },
    { key: "1_30", label: "1–30 days late", tone: "text-amber-700" },
    { key: "31_60", label: "31–60 days late", tone: "text-orange-700" },
    { key: "61_90", label: "61–90 days late", tone: "text-red-700" },
    { key: "90_plus", label: "90+ days late", tone: "text-red-800" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aged receivables"
        subtitle={`Unpaid milestones (${rows.length}) totaling ${money(grand)}. Bucketed by days past the due date.`}
        actions={
          <Link
            href="/dashboard/reports"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← All reports
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-5">
        {cols.map((c) => (
          <div
            key={c.key}
            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {c.label}
            </p>
            <p className={`mt-0.5 text-lg font-semibold ${c.tone}`}>
              {money(buckets[c.key].total)}
            </p>
            <p className="text-[11px] text-neutral-500">
              {buckets[c.key].rows.length} milestone
              {buckets[c.key].rows.length === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No unpaid milestones"
          description="Everything's collected. 🎉"
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Days late</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Milestone</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cols.flatMap((c) =>
                buckets[c.key].rows.map((r) => {
                  const sched = Array.isArray(r.schedule)
                    ? r.schedule[0]
                    : r.schedule;
                  const p = sched?.project
                    ? Array.isArray(sched.project)
                      ? sched.project[0]
                      : sched.project
                    : null;
                  const client = p?.client
                    ? Array.isArray(p.client)
                      ? p.client[0]
                      : p.client
                    : null;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-2">{dateShort(r.due_date)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.days === 0
                              ? "bg-neutral-100 text-neutral-700"
                              : r.days <= 30
                                ? "bg-amber-100 text-amber-800"
                                : r.days <= 90
                                  ? "bg-red-100 text-red-800"
                                  : "bg-red-200 text-red-900"
                          }`}
                        >
                          {r.days === 0 ? "current" : `${r.days}d`}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {client?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {p ? (
                          <Link
                            href={`/dashboard/projects/${p.id}`}
                            className="text-brand-700 hover:underline"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-600">
                        {r.label}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-neutral-900">
                        {money(r.total_with_fee ?? r.amount)}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
