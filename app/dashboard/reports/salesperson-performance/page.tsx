import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";

export const metadata = { title: "Salesperson performance — Rose Concrete" };

type SearchParams = Promise<{ window?: "30" | "90" | "365" | "all" }>;

/**
 * Salesperson performance report — quotes sent / accepted / revenue per
 * salesperson. `quotes.salesperson_id` was added in migration 032.
 * Matches Jobber's Reports → Work reports → "Salesperson performance".
 */
export default async function SalespersonPerformanceReport({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { window } = await searchParams;
  const win = window ?? "365";
  const cutoff =
    win === "all"
      ? null
      : new Date(
          Date.now() - Number(win) * 24 * 60 * 60 * 1000,
        ).toISOString();

  const supabase = await createClient();
  let builder = supabase
    .from("quotes")
    .select(
      "id, status, base_total, optional_total, accepted_total, issued_at, salesperson_id, salesperson:profiles(full_name, email)",
    )
    .not("salesperson_id", "is", null)
    .limit(5000);
  if (cutoff) builder = builder.gte("issued_at", cutoff);
  const { data } = await builder;

  type Row = {
    id: string;
    status: string;
    base_total: number | string | null;
    optional_total: number | string | null;
    accepted_total: number | string | null;
    salesperson_id: string;
    salesperson:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
  };
  const quotes = (data ?? []) as Row[];

  type Agg = {
    id: string;
    name: string;
    sent: number;
    accepted: number;
    sentValue: number;
    wonValue: number;
  };
  const byPerson = new Map<string, Agg>();
  for (const q of quotes) {
    const sp = Array.isArray(q.salesperson) ? q.salesperson[0] : q.salesperson;
    const name = sp?.full_name ?? sp?.email ?? "Unknown";
    const a = byPerson.get(q.salesperson_id) ?? {
      id: q.salesperson_id,
      name,
      sent: 0,
      accepted: 0,
      sentValue: 0,
      wonValue: 0,
    };
    const baseValue =
      Number(q.base_total ?? 0) + Number(q.optional_total ?? 0);
    if (q.status !== "draft") {
      a.sent += 1;
      a.sentValue += baseValue;
    }
    if (q.status === "accepted") {
      a.accepted += 1;
      a.wonValue += Number(q.accepted_total ?? baseValue);
    }
    byPerson.set(q.salesperson_id, a);
  }

  const rows = Array.from(byPerson.values())
    .map((r) => ({
      ...r,
      conversionRate: r.sent > 0 ? r.accepted / r.sent : 0,
    }))
    .sort((a, b) => b.wonValue - a.wonValue);

  const WINDOWS: Array<{ key: "30" | "90" | "365" | "all"; label: string }> = [
    { key: "30", label: "30 days" },
    { key: "90", label: "90 days" },
    { key: "365", label: "1 year" },
    { key: "all", label: "All time" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salesperson performance"
        subtitle="Quotes sent, conversion rate, and revenue won per salesperson. Requires the salesperson field on quotes."
        actions={
          <Link
            href="/dashboard/reports"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← All reports
          </Link>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`/dashboard/reports/salesperson-performance?window=${w.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              win === w.key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No salesperson-tagged quotes in window"
          description="Assign a salesperson on the quote detail page to populate this report."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Salesperson</th>
                <th className="px-4 py-2 text-right">Sent</th>
                <th className="px-4 py-2 text-right">Accepted</th>
                <th className="px-4 py-2 text-right">Conv. rate</th>
                <th className="px-4 py-2 text-right">Pipeline $</th>
                <th className="px-4 py-2 text-right">Won $</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.sent}</td>
                  <td className="px-4 py-2 text-right">{r.accepted}</td>
                  <td className="px-4 py-2 text-right">
                    {(r.conversionRate * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2 text-right text-neutral-700">
                    {money(r.sentValue)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {money(r.wonValue)}
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
