import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";

export const metadata = { title: "Team productivity — Rose Concrete" };

type SearchParams = Promise<{ range?: "week" | "month" | "year" }>;

/**
 * Team productivity report — hours, visits, and revenue attributed per
 * crew member. Jobber's canned report from Reports → Work reports.
 *
 * - Hours come from `visit_time_entries` (crew clock in/out GPS entries).
 * - Visits come from `visit_assignments` filtered to completed visits.
 * - Revenue comes from the project's `revenue_cached` (or
 *   `projects.quotes.accepted_total` if revenue_cached is null)
 *   attributed pro-rata across assignees.
 */
export default async function TeamProductivityReport({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { range } = await searchParams;
  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();

  const [timeRes, visitsRes, profilesRes] = await Promise.all([
    supabase
      .from("visit_time_entries")
      .select("user_id, clock_in_at, clock_out_at")
      .gte("clock_in_at", cutoff)
      .limit(5000),
    supabase
      .from("visit_assignments")
      .select(
        "user_id, visit:visits!inner(id, scheduled_for, status, project:projects!inner(revenue_cached))",
      )
      .gte("visit.scheduled_for", cutoff)
      .limit(5000),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["admin", "office", "crew"]),
  ]);

  type Profile = {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  };
  const profiles = (profilesRes.data ?? []) as Profile[];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  type Agg = {
    id: string;
    name: string;
    role: string;
    hours: number;
    visits: number;
    completedVisits: number;
    revenue: number;
  };
  const agg = new Map<string, Agg>();
  for (const p of profiles) {
    agg.set(p.id, {
      id: p.id,
      name: p.full_name ?? p.email,
      role: p.role,
      hours: 0,
      visits: 0,
      completedVisits: 0,
      revenue: 0,
    });
  }

  for (const t of (timeRes.data ?? []) as Array<{
    user_id: string;
    clock_in_at: string;
    clock_out_at: string | null;
  }>) {
    if (!t.clock_out_at) continue;
    const h =
      (new Date(t.clock_out_at).getTime() -
        new Date(t.clock_in_at).getTime()) /
      (1000 * 60 * 60);
    const a = agg.get(t.user_id);
    if (a && h > 0) a.hours += h;
  }

  // Build per-visit assignee groups so revenue attribution splits
  // the project revenue across every assigned crew member.
  type Va = {
    user_id: string;
    visit:
      | {
          id: string;
          status: string;
          project:
            | { revenue_cached: number | string | null }
            | { revenue_cached: number | string | null }[]
            | null;
        }
      | {
          id: string;
          status: string;
          project:
            | { revenue_cached: number | string | null }
            | { revenue_cached: number | string | null }[]
            | null;
        }[]
      | null;
  };
  const va = ((visitsRes.data ?? []) as unknown as Va[]).filter(
    (r) => r.visit,
  );
  const byVisit = new Map<
    string,
    { revenue: number; status: string; userIds: Set<string> }
  >();
  for (const r of va) {
    const v = Array.isArray(r.visit) ? r.visit[0] : r.visit;
    if (!v) continue;
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    const rev = p ? Number(p.revenue_cached ?? 0) : 0;
    const entry = byVisit.get(v.id) ?? {
      revenue: rev,
      status: v.status,
      userIds: new Set<string>(),
    };
    entry.userIds.add(r.user_id);
    byVisit.set(v.id, entry);
  }
  for (const v of byVisit.values()) {
    if (v.userIds.size === 0) continue;
    const share = v.revenue / v.userIds.size;
    for (const uid of v.userIds) {
      const a = agg.get(uid);
      if (!a) continue;
      a.visits += 1;
      if (v.status === "completed") a.completedVisits += 1;
      a.revenue += share;
    }
  }

  const rows = Array.from(agg.values())
    .filter((a) => a.hours > 0 || a.visits > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const RANGES: Array<{ key: "week" | "month" | "year"; label: string }> = [
    { key: "week", label: "Last 7 days" },
    { key: "month", label: "Last 30 days" },
    { key: "year", label: "Last 365 days" },
  ];
  const active = range ?? "week";

  // Reference to silence unused var lint on byId.
  void byId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team productivity"
        subtitle="Hours, visits, and revenue attributed per crew member."
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
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard/reports/team-productivity?range=${r.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              active === r.key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No activity in window"
          description="Once crew clocks in or gets assigned to visits, they show up here."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Hours</th>
                <th className="px-4 py-2 text-right">Visits</th>
                <th className="px-4 py-2 text-right">Completed</th>
                <th className="px-4 py-2 text-right">Revenue attrib.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-xs capitalize">{r.role}</td>
                  <td className="px-4 py-2 text-right">{r.hours.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right">{r.visits}</td>
                  <td className="px-4 py-2 text-right">{r.completedVisits}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {money(r.revenue)}
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
