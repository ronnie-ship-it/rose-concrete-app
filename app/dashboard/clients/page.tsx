import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { JobCard, EmptyState } from "@/components/ui";

export const metadata = { title: "Clients — Rose Concrete" };

type SearchParams = Promise<{ q?: string; view?: string; sort?: string }>;

/**
 * Jobber-parity Clients list (`/clients`).
 *
 *   ┌ Clients                                    + New Client  ⋯ More ┐
 *   │                                                                 │
 *   │ [ New leads ↓82% ]  [ New clients ↑50% ]  [ YTD new clients ]  │  <- KPI strip
 *   │                                                                 │
 *   │  Active │ Archived                                Newest · A-Z │  <- tabs
 *   │                                                                 │
 *   │  [ q search ]                                                   │
 *   │                                                                 │
 *   │  ┌────────────────────────────────────────────────────────────┐ │
 *   │  │ ☐ Name        Address      Tags  Status   Last Activity    │ │
 *   │  ├────────────────────────────────────────────────────────────┤ │
 *   │  │ ☐ Jane Smith  1234 Oak St  —     ● Active 46 minutes ago   │ │
 *   │  │ …                                                          │ │
 *   │  └────────────────────────────────────────────────────────────┘ │
 *   └─────────────────────────────────────────────────────────────────┘
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { q, view, sort } = await searchParams;
  const query = (q ?? "").trim();
  const activeView = view === "archived" ? "archived" : "active";
  const sortMode: "recent" | "alpha" = sort === "alpha" ? "alpha" : "recent";

  const supabase = await createClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600_000).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  let builder = supabase
    .from("clients")
    .select(
      "id, name, phone, email, city, source, created_at, updated_at, archived_at",
    )
    .limit(200);
  builder =
    sortMode === "alpha"
      ? builder.order("name", { ascending: true })
      : builder
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
  builder =
    activeView === "archived"
      ? builder.not("archived_at", "is", null)
      : builder.is("archived_at", null);
  if (query) {
    const pattern = `%${query}%`;
    builder = builder.or(
      `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`,
    );
  }

  const [
    { data: clients, error },
    { count: otherCount },
    { count: newLeads30 },
    { count: newLeadsPrev30 },
    { count: newClients30 },
    { count: newClientsPrev30 },
    { count: newClientsYtd },
  ] = await Promise.all([
    builder,
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .filter("archived_at", activeView === "archived" ? "is" : "not.is", null),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("captured_at", thirtyDaysAgo),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("captured_at", sixtyDaysAgo)
      .lt("captured_at", thirtyDaysAgo),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sixtyDaysAgo)
      .lt("created_at", thirtyDaysAgo),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yearStart),
  ]);

  const leadsDelta = pctDelta(newLeads30 ?? 0, newLeadsPrev30 ?? 0);
  const clientsDelta = pctDelta(newClients30 ?? 0, newClientsPrev30 ?? 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
          Clients
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/clients/new"
            className="inline-flex items-center justify-center rounded-full bg-jobber-green px-4 py-2 text-sm font-bold text-neutral-900 shadow-sm transition hover:brightness-110"
          >
            + New Client
          </Link>
          <Link
            href="/dashboard/settings/import"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-jobber-line dark:bg-jobber-card dark:text-white dark:hover:bg-white/5"
          >
            ⋯ More Actions
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="New leads"
          subLabel="Past 30 days"
          value={String(newLeads30 ?? 0)}
          delta={leadsDelta}
          href="/dashboard/requests"
        />
        <KpiCard
          title="New clients"
          subLabel="Past 30 days"
          value={String(newClients30 ?? 0)}
          delta={clientsDelta}
          href="/dashboard/clients"
        />
        <KpiCard
          title="Total new clients"
          subLabel="Year to date"
          value={String(newClientsYtd ?? 0)}
          href="/dashboard/reports"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 text-sm dark:border-jobber-line">
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/clients${buildQuery({ q: query, sort: sortMode })}`}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
              activeView === "active"
                ? "border-jobber-green text-neutral-900 dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-jobber-text-2 dark:hover:text-white"
            }`}
          >
            Active
            {activeView === "archived" && otherCount != null ? ` (${otherCount})` : ""}
          </Link>
          <Link
            href={`/dashboard/clients${buildQuery({ view: "archived", q: query, sort: sortMode })}`}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
              activeView === "archived"
                ? "border-jobber-green text-neutral-900 dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-jobber-text-2 dark:hover:text-white"
            }`}
          >
            Archived
            {activeView === "active" && otherCount != null ? ` (${otherCount})` : ""}
          </Link>
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white p-0.5 text-xs dark:border-jobber-line dark:bg-jobber-card">
          <Link
            href={`/dashboard/clients${buildQuery({ view: activeView, q: query })}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              sortMode === "recent"
                ? "bg-jobber-green text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-jobber-text-2 dark:hover:bg-white/5"
            }`}
          >
            Newest
          </Link>
          <Link
            href={`/dashboard/clients${buildQuery({ view: activeView, q: query, sort: "alpha" })}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              sortMode === "alpha"
                ? "bg-jobber-green text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-jobber-text-2 dark:hover:bg-white/5"
            }`}
          >
            A–Z
          </Link>
        </div>
      </div>

      {/* Search */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-jobber-line dark:bg-jobber-card"
      >
        <div className="relative max-w-md flex-1">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search clients…"
            className="w-full rounded-full border border-neutral-300 bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:border-jobber-green focus:outline-none focus:ring-1 focus:ring-jobber-green dark:border-jobber-line dark:bg-jobber-bg dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-jobber-line dark:bg-jobber-bg dark:text-white dark:hover:bg-white/5"
        >
          Search
        </button>
        {query && (
          <Link
            href="/dashboard/clients"
            className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:underline dark:text-jobber-text-2"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t load clients: {error.message}
        </p>
      )}

      {clients && clients.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-jobber-line dark:bg-jobber-card md:block">
            <p className="border-b border-neutral-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:border-jobber-line dark:text-jobber-text-2">
              Filtered clients ({clients.length} {clients.length === 1 ? "result" : "results"})
            </p>
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500 dark:border-jobber-line dark:bg-jobber-bg dark:text-jobber-text-2">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Address</th>
                  <th className="px-4 py-2.5">Tags</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-jobber-line dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="font-semibold text-neutral-900 hover:underline dark:text-white"
                      >
                        {c.name}
                      </Link>
                      {[c.phone, c.email].filter(Boolean).length > 0 && (
                        <p className="text-[11px] text-neutral-500 dark:text-jobber-text-2">
                          {[c.phone, c.email].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 dark:text-jobber-text-2">
                      {c.city ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 dark:text-jobber-text-3">
                      —
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill archived={Boolean(c.archived_at)} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500 dark:text-jobber-text-2">
                      {relativeTime(c.updated_at ?? c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="grid gap-2 md:hidden">
            {clients.map((c) => {
              const meta = [c.phone, c.email, c.city].filter(Boolean).join(" · ");
              return (
                <JobCard
                  key={c.id}
                  href={`/dashboard/clients/${c.id}`}
                  title={c.name}
                  meta={meta || undefined}
                  right={<StatusPill archived={Boolean(c.archived_at)} />}
                />
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title={query ? "No clients match" : "No clients yet"}
          description={query ? "Try a different search." : "Add your first client to get started."}
          action={
            !query ? (
              <Link
                href="/dashboard/clients/new"
                className="inline-flex items-center justify-center rounded-full bg-jobber-green px-4 py-2 text-sm font-bold text-neutral-900 shadow-sm transition hover:brightness-110"
              >
                + New Client
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function pctDelta(
  now: number,
  prev: number,
): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (prev === 0 && now === 0) return null;
  if (prev === 0) return { pct: 100, direction: "up" };
  const delta = ((now - prev) / prev) * 100;
  if (Math.abs(delta) < 1) return { pct: 0, direction: "flat" };
  return {
    pct: Math.round(Math.abs(delta)),
    direction: delta > 0 ? "up" : "down",
  };
}

function KpiCard({
  title,
  subLabel,
  value,
  delta,
  href,
}: {
  title: string;
  subLabel: string;
  value: string;
  delta?: { pct: number; direction: "up" | "down" | "flat" } | null;
  href: string;
}) {
  const isUp = delta?.direction === "up";
  const isDown = delta?.direction === "down";
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 dark:border-jobber-line dark:bg-jobber-card"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 dark:text-jobber-text-2">
        {title}
      </p>
      <p className="text-[11px] text-neutral-500 dark:text-jobber-text-2">
        {subLabel}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-3xl font-extrabold text-neutral-900 dark:text-white">
          {value}
        </p>
        {delta && delta.direction !== "flat" && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isUp
                ? "bg-emerald-100 text-emerald-800 dark:bg-jobber-green/20 dark:text-jobber-green"
                : "bg-red-100 text-red-700 dark:bg-jobber-red/20 dark:text-jobber-red"
            }`}
          >
            <span>{isUp ? "↑" : isDown ? "↓" : "→"}</span>
            <span>{delta.pct}%</span>
          </span>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 text-neutral-400 opacity-0 transition group-hover:opacity-100"
      >
        ↗
      </span>
    </Link>
  );
}

function StatusPill({ archived }: { archived: boolean }) {
  if (archived)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-white/10 dark:text-jobber-text-2">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
        Archived
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-jobber-green/20 dark:text-jobber-green">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(now - then, 0);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Just now";
  if (diff < hour) {
    const m = Math.round(diff / minute);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (diff < 7 * day) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildQuery(params: { view?: string; q?: string; sort?: string }): string {
  const entries: Array<[string, string]> = [];
  if (params.view && params.view !== "active") entries.push(["view", params.view]);
  if (params.q) entries.push(["q", params.q]);
  if (params.sort && params.sort !== "recent") entries.push(["sort", params.sort]);
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}
