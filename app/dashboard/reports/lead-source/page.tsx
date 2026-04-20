import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";

export const metadata = { title: "Lead source report — Rose Concrete" };

type SearchParams = Promise<{ window?: "30" | "90" | "365" | "all" }>;

/**
 * Lead source performance report. Groups `leads` by `source` and joins
 * to the accepted-quote amount on the same project to report actual
 * revenue attribution per source + conversion rate. Mirrors Jobber's
 * "Lead Source" canned report from Reports → Client reports.
 */
export default async function LeadSourceReport({
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
    .from("leads")
    .select(
      "id, source, status, captured_at, quote_id, quote:quotes(accepted_total, status)",
    )
    .limit(5000);
  if (cutoff) builder = builder.gte("captured_at", cutoff);
  const { data } = await builder;

  type Row = {
    id: string;
    source: string | null;
    status: string;
    captured_at: string;
    quote_id: string | null;
    quote:
      | { accepted_total: number | string | null; status: string }
      | { accepted_total: number | string | null; status: string }[]
      | null;
  };
  const leads = (data ?? []) as Row[];

  const bySource = new Map<
    string,
    { leads: number; converted: number; revenue: number }
  >();
  for (const l of leads) {
    const key = (l.source ?? "unknown").trim() || "unknown";
    const entry = bySource.get(key) ?? {
      leads: 0,
      converted: 0,
      revenue: 0,
    };
    entry.leads += 1;
    const q = Array.isArray(l.quote) ? l.quote[0] : l.quote;
    const qStatus = q?.status;
    if (l.status === "converted" || qStatus === "accepted") {
      entry.converted += 1;
      entry.revenue += Number(q?.accepted_total ?? 0);
    }
    bySource.set(key, entry);
  }

  const rows = Array.from(bySource.entries())
    .map(([source, v]) => ({
      source,
      ...v,
      conversionRate: v.leads > 0 ? v.converted / v.leads : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  const WINDOWS: Array<{ key: "30" | "90" | "365" | "all"; label: string }> = [
    { key: "30", label: "30 days" },
    { key: "90", label: "90 days" },
    { key: "365", label: "1 year" },
    { key: "all", label: "All time" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead source report"
        subtitle="Revenue + conversion rate per lead source. Helps decide where to spend marketing dollars."
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
            href={`/dashboard/reports/lead-source?window=${w.key}`}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Sources" value={String(rows.length)} />
        <SummaryCard label="Leads in window" value={String(totalLeads)} />
        <SummaryCard label="Revenue attributed" value={money(totalRevenue)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No leads in this window"
          description="Try widening the date range."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Leads</th>
                <th className="px-4 py-2 text-right">Converted</th>
                <th className="px-4 py-2 text-right">Conv. rate</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">$/Lead</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.source}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{r.source}</td>
                  <td className="px-4 py-2 text-right">{r.leads}</td>
                  <td className="px-4 py-2 text-right">{r.converted}</td>
                  <td className="px-4 py-2 text-right">
                    {(r.conversionRate * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {money(r.revenue)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-neutral-500">
                    {r.leads > 0 ? money(r.revenue / r.leads) : "—"}
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
