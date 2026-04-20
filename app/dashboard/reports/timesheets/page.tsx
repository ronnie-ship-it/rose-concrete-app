import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money, dateShort } from "@/lib/format";

export const metadata = { title: "Timesheets — Rose Concrete" };

type SearchParams = Promise<{ range?: "week" | "month" | "year" }>;

/**
 * Crew timesheet report. Pulls `visit_time_entries` (clock in/out GPS
 * entries seeded from the /crew page) aggregated per user + per day.
 * Mirrors Jobber's "Timesheets" canned report.
 */
export default async function TimesheetsReport({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { range } = await searchParams;
  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_time_entries")
    .select(
      "id, visit_id, user_id, clock_in_at, clock_out_at, clock_in_lat, clock_in_lng, user:profiles(full_name, email), visit:visits(project:projects(id, name, client:clients(name)))",
    )
    .gte("clock_in_at", cutoff.toISOString())
    .order("clock_in_at", { ascending: false })
    .limit(1000);

  type Row = {
    id: string;
    visit_id: string;
    user_id: string;
    clock_in_at: string;
    clock_out_at: string | null;
    user: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
    visit:
      | {
          project:
            | { id: string; name: string; client: { name: string } | { name: string }[] | null }
            | { id: string; name: string; client: unknown }[]
            | null;
        }
      | {
          project:
            | { id: string; name: string; client: { name: string } | { name: string }[] | null }
            | { id: string; name: string; client: unknown }[]
            | null;
        }[]
      | null;
  };
  const entries = (data ?? []) as unknown as Row[];

  // Aggregate per user.
  const perUser = new Map<
    string,
    { name: string; hours: number; openEntries: number }
  >();
  let totalHours = 0;
  let openEntries = 0;
  for (const e of entries) {
    const u = Array.isArray(e.user) ? e.user[0] : e.user;
    const name = u?.full_name ?? u?.email ?? "Unknown";
    const entry = perUser.get(e.user_id) ?? {
      name,
      hours: 0,
      openEntries: 0,
    };
    if (e.clock_out_at) {
      const ms =
        new Date(e.clock_out_at).getTime() -
        new Date(e.clock_in_at).getTime();
      const hours = Math.max(0, ms / (1000 * 60 * 60));
      entry.hours += hours;
      totalHours += hours;
    } else {
      entry.openEntries += 1;
      openEntries += 1;
    }
    perUser.set(e.user_id, entry);
  }

  const perUserRows = Array.from(perUser.entries()).sort(
    (a, b) => b[1].hours - a[1].hours,
  );

  const RANGES: Array<{ key: "week" | "month" | "year"; label: string }> = [
    { key: "week", label: "Last 7 days" },
    { key: "month", label: "Last 30 days" },
    { key: "year", label: "Last 365 days" },
  ];
  const active = range ?? "week";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        subtitle={`Crew hours logged via clock in/out. ${totalHours.toFixed(1)} hours across ${entries.length} entries${openEntries > 0 ? `, ${openEntries} still clocked in` : ""}.`}
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
            href={`/dashboard/reports/timesheets?range=${r.key}`}
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

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Per crew member
        </h2>
        {perUserRows.length === 0 ? (
          <EmptyState
            title="No time entries"
            description="Once crew clocks in from /crew, hours show up here."
          />
        ) : (
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Crew member</th>
                  <th className="px-4 py-2 text-right">Hours</th>
                  <th className="px-4 py-2 text-right">Still clocked in</th>
                  <th className="px-4 py-2 text-right">Est. labor cost @ $45/hr</th>
                </tr>
              </thead>
              <tbody>
                {perUserRows.map(([id, v]) => (
                  <tr
                    key={id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-4 py-2 font-medium">{v.name}</td>
                    <td className="px-4 py-2 text-right">
                      {v.hours.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-neutral-500">
                      {v.openEntries > 0 ? `${v.openEntries} open` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {money(v.hours * 45)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Raw entries
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">No entries in window.</p>
        ) : (
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Crew</th>
                  <th className="px-4 py-2">Clock in</th>
                  <th className="px-4 py-2">Clock out</th>
                  <th className="px-4 py-2">Hours</th>
                  <th className="px-4 py-2">Project</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 200).map((e) => {
                  const u = Array.isArray(e.user) ? e.user[0] : e.user;
                  const v = Array.isArray(e.visit) ? e.visit[0] : e.visit;
                  const p = v?.project
                    ? Array.isArray(v.project)
                      ? v.project[0]
                      : v.project
                    : null;
                  const c = p?.client
                    ? Array.isArray(p.client)
                      ? (p.client as Array<{ name: string }>)[0]
                      : (p.client as { name: string } | null)
                    : null;
                  const durHrs = e.clock_out_at
                    ? Math.max(
                        0,
                        (new Date(e.clock_out_at).getTime() -
                          new Date(e.clock_in_at).getTime()) /
                          (1000 * 60 * 60),
                      )
                    : null;
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-2">{u?.full_name ?? u?.email ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">
                        {dateShort(e.clock_in_at)}{" "}
                        {new Date(e.clock_in_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {e.clock_out_at
                          ? new Date(e.clock_out_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "🟢 still on clock"}
                      </td>
                      <td className="px-4 py-2">
                        {durHrs != null ? durHrs.toFixed(1) : "—"}
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
                        {c?.name && (
                          <p className="text-[11px] text-neutral-500">
                            {c.name}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
