import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money, dateShort } from "@/lib/format";

export const metadata = { title: "Client balance summary — Rose Concrete" };

/**
 * Client balance summary — one row per client with total invoiced, paid
 * to date, outstanding balance, and the last payment date. Matches
 * Jobber's "Client balance summary" canned report (flagged NEW there).
 */
export default async function ClientBalanceReport() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: milestones } = await supabase
    .from("payment_milestones")
    .select(
      "amount, total_with_fee, qbo_paid_amount, qbo_paid_at, status, schedule:payment_schedules!inner(project:projects!inner(id, client_id, client:clients(id, name)))",
    )
    .limit(10000);

  type M = {
    amount: number | string;
    total_with_fee: number | string | null;
    qbo_paid_amount: number | string | null;
    qbo_paid_at: string | null;
    status: string;
    schedule:
      | {
          project:
            | {
                id: string;
                client_id: string;
                client:
                  | { id: string; name: string }
                  | { id: string; name: string }[]
                  | null;
              }
            | {
                id: string;
                client_id: string;
                client:
                  | { id: string; name: string }
                  | { id: string; name: string }[]
                  | null;
              }[]
            | null;
        }
      | {
          project:
            | {
                id: string;
                client_id: string;
                client:
                  | { id: string; name: string }
                  | { id: string; name: string }[]
                  | null;
              }
            | {
                id: string;
                client_id: string;
                client:
                  | { id: string; name: string }
                  | { id: string; name: string }[]
                  | null;
              }[]
            | null;
        }[]
      | null;
  };

  type Agg = {
    id: string;
    name: string;
    invoiced: number;
    paid: number;
    lastPaidAt: string | null;
  };
  const byClient = new Map<string, Agg>();

  for (const m of (milestones ?? []) as unknown as M[]) {
    const sched = Array.isArray(m.schedule) ? m.schedule[0] : m.schedule;
    if (!sched) continue;
    const p = Array.isArray(sched.project) ? sched.project[0] : sched.project;
    if (!p) continue;
    const c = Array.isArray(p.client) ? p.client[0] : p.client;
    if (!c) continue;
    const agg = byClient.get(c.id) ?? {
      id: c.id,
      name: c.name,
      invoiced: 0,
      paid: 0,
      lastPaidAt: null,
    };
    const billed = Number(m.total_with_fee ?? m.amount ?? 0);
    agg.invoiced += billed;
    if (m.status === "paid") {
      const paid = Number(
        m.qbo_paid_amount ?? m.total_with_fee ?? m.amount ?? 0,
      );
      agg.paid += paid;
      if (m.qbo_paid_at && (!agg.lastPaidAt || m.qbo_paid_at > agg.lastPaidAt)) {
        agg.lastPaidAt = m.qbo_paid_at;
      }
    }
    byClient.set(c.id, agg);
  }

  const rows = Array.from(byClient.values())
    .map((r) => ({
      ...r,
      outstanding: Math.max(0, r.invoiced - r.paid),
    }))
    .sort((a, b) => b.outstanding - a.outstanding || b.invoiced - a.invoiced);

  const totalInvoiced = rows.reduce((s, r) => s + r.invoiced, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client balance summary"
        subtitle="Total invoiced, paid, and outstanding per client."
        actions={
          <Link
            href="/dashboard/reports"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← All reports
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total invoiced" value={money(totalInvoiced)} />
        <StatCard label="Total paid" value={money(totalPaid)} tone="success" />
        <StatCard
          label="Total outstanding"
          value={money(totalOutstanding)}
          tone={totalOutstanding > 0 ? "warning" : "neutral"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No invoices on record"
          description="Milestones need to be created before balances populate."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2 text-right">Invoiced</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Outstanding</th>
                <th className="px-4 py-2 text-right">Last payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/clients/${r.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{money(r.invoiced)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">
                    {money(r.paid)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold ${
                      r.outstanding > 0 ? "text-amber-700" : "text-neutral-500"
                    }`}
                  >
                    {money(r.outstanding)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-neutral-500">
                    {r.lastPaidAt ? dateShort(r.lastPaidAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "neutral";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-lg border ${cls} p-4 shadow-sm`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
