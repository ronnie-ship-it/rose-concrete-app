import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "Client re-engagement — Rose Concrete" };

type SearchParams = Promise<{ bucket?: "90" | "180" | "365" }>;

/**
 * Client re-engagement report. Lists clients whose most-recent completed
 * project (or accepted quote) is older than 90 / 180 / 365 days.
 * Surfaces the right target pool for a win-back SMS campaign.
 */
export default async function ClientReengagementReport({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { bucket } = await searchParams;
  const days = bucket === "180" ? 180 : bucket === "365" ? 365 : 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  // Pull every client with at least one accepted quote, plus the
  // max(accepted_at) per client so we can filter to "last job > N days ago".
  const { data: clients } = await supabase
    .from("clients")
    .select(
      "id, name, phone, email, projects:projects(id, completed_at, status, revenue_cached, quotes:quotes(accepted_at, accepted_total))",
    )
    .order("name", { ascending: true })
    .limit(1000);

  type C = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    projects:
      | Array<{
          id: string;
          completed_at: string | null;
          status: string;
          revenue_cached: number | string | null;
          quotes:
            | Array<{
                accepted_at: string | null;
                accepted_total: number | string | null;
              }>
            | null;
        }>
      | null;
  };

  type Row = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    lastAt: string | null;
    lifetimeValue: number;
    projectCount: number;
  };
  const rows: Row[] = [];
  for (const c of (clients ?? []) as unknown as C[]) {
    const projects = c.projects ?? [];
    if (projects.length === 0) continue;
    let lastAt: string | null = null;
    let ltv = 0;
    for (const p of projects) {
      if (p.completed_at && (!lastAt || p.completed_at > lastAt)) {
        lastAt = p.completed_at;
      }
      const quotes = p.quotes ?? [];
      for (const q of quotes) {
        if (q.accepted_at && (!lastAt || q.accepted_at > lastAt)) {
          lastAt = q.accepted_at;
        }
        ltv += Number(q.accepted_total ?? 0);
      }
      ltv += Number(p.revenue_cached ?? 0) * 0.0; // avoid double count
    }
    if (!lastAt) continue;
    if (new Date(lastAt).getTime() > cutoff.getTime()) continue;
    rows.push({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      lastAt,
      lifetimeValue: ltv,
      projectCount: projects.length,
    });
  }
  rows.sort((a, b) => (a.lastAt ?? "").localeCompare(b.lastAt ?? ""));

  const BUCKETS: Array<{ key: "90" | "180" | "365"; label: string }> = [
    { key: "90", label: "90+ days quiet" },
    { key: "180", label: "180+ days quiet" },
    { key: "365", label: "365+ days quiet" },
  ];
  const activeBucket = bucket ?? "90";

  const totalLtv = rows.reduce((s, r) => s + r.lifetimeValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client re-engagement"
        subtitle={`${rows.length} client${rows.length === 1 ? "" : "s"} haven't had activity in ${days}+ days. Ripe for a win-back text.`}
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
        {BUCKETS.map((b) => (
          <Link
            key={b.key}
            href={`/dashboard/reports/client-reengagement?bucket=${b.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeBucket === b.key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Everyone's recent"
          description="No clients match this window — nice problem to have."
        />
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            Combined lifetime value in pool: <strong>{money(totalLtv)}</strong>
          </p>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2 text-right">Last activity</th>
                  <th className="px-4 py-2 text-right">Jobs</th>
                  <th className="px-4 py-2 text-right">Lifetime</th>
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
                    <td className="px-4 py-2 text-xs text-neutral-600">
                      {r.phone && (
                        <a
                          href={`tel:${r.phone}`}
                          className="hover:underline"
                        >
                          {r.phone}
                        </a>
                      )}
                      {r.email && (
                        <>
                          <br />
                          <a
                            href={`mailto:${r.email}`}
                            className="hover:underline"
                          >
                            {r.email}
                          </a>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-700">
                      {dateShort(r.lastAt)}
                    </td>
                    <td className="px-4 py-2 text-right">{r.projectCount}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {money(r.lifetimeValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
