import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, JobCard, EmptyState } from "@/components/ui";

export const metadata = { title: "Clients — Rose Concrete" };

type SearchParams = Promise<{ q?: string; view?: string; sort?: string }>;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { q, view, sort } = await searchParams;
  const query = (q ?? "").trim();
  const activeView = view === "archived" ? "archived" : "active";
  // Jobber defaults to newest-first (UPDATED_AT DESC). Ronnie can
  // flip to alphabetical via the toggle — handy when the list is
  // large enough that recency stops being the right anchor.
  const sortMode: "recent" | "alpha" = sort === "alpha" ? "alpha" : "recent";

  const supabase = await createClient();
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
      `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`
    );
  }

  const { data: clients, error } = await builder;

  // Count for the other tab's badge — cheap server-side count so
  // Ronnie sees at a glance how many archived clients exist.
  const { count: otherCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .filter(
      "archived_at",
      activeView === "archived" ? "is" : "not.is",
      null,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${clients?.length ?? 0} ${
          clients?.length === 1 ? "client" : "clients"
        }${activeView === "archived" ? " · archived" : ""}${query ? ` matching "${query}"` : ""}`}
        actions={
          <Link
            href="/dashboard/clients/new"
            className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            + New client
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 text-sm">
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/clients${buildQuery({ q: query, sort: sortMode })}`}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
              activeView === "active"
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Active
            {activeView === "archived" && otherCount != null
              ? ` (${otherCount})`
              : ""}
          </Link>
          <Link
            href={`/dashboard/clients${buildQuery({ view: "archived", q: query, sort: sortMode })}`}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
              activeView === "archived"
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Archived
            {activeView === "active" && otherCount != null
              ? ` (${otherCount})`
              : ""}
          </Link>
        </div>
        {/* Newest / A-Z toggle — pill group, keeps URL state. */}
        <div className="flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white p-0.5 text-xs">
          <Link
            href={`/dashboard/clients${buildQuery({ view: activeView, q: query })}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              sortMode === "recent"
                ? "bg-brand-600 text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Newest
          </Link>
          <Link
            href={`/dashboard/clients${buildQuery({ view: activeView, q: query, sort: "alpha" })}`}
            className={`rounded-full px-3 py-1 font-semibold ${
              sortMode === "alpha"
                ? "bg-brand-600 text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            A–Z
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-white p-3"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, phone, email, city…"
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Search
        </button>
        {query && (
          <Link
            href="/dashboard/clients"
            className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Couldn't load clients: {error.message}
        </p>
      )}

      {clients && clients.length > 0 ? (
        <>
          {/* Desktop — Jobber-parity table (Name / Contact / Address /
              Status / Last Activity). Rows are full-width clickable. */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-brand-700 dark:bg-brand-800 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-brand-700 dark:bg-brand-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">City</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-brand-700 dark:hover:bg-brand-900/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="font-semibold text-brand-700 hover:underline dark:text-white"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300">
                      {c.city ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.archived_at ? (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                          Archived
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-500 dark:text-neutral-400">
                      {relativeTime(c.updated_at ?? c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile — big JobCard rows with min-h-16 tap targets. */}
          <div className="grid gap-2 md:hidden">
            {clients.map((c) => {
              const meta = [c.phone, c.email, c.city]
                .filter(Boolean)
                .join(" · ");
              return (
                <JobCard
                  key={c.id}
                  href={`/dashboard/clients/${c.id}`}
                  title={c.name}
                  meta={meta || undefined}
                  right={
                    c.archived_at ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                        Archived
                      </span>
                    ) : c.source ? (
                      <span className="text-xs text-neutral-500">
                        {c.source}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title={query ? "No clients match" : "No clients yet"}
          description={
            query
              ? "Try a different search."
              : "Add your first client to get started."
          }
          action={
            !query ? (
              <Link
                href="/dashboard/clients/new"
                className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                + New client
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

/**
 * Compact "time since" label for the Last Activity column — matches
 * Jobber's "46 minutes ago", "2:52 PM", "Fri", "Apr 3" ladder. Uses
 * simple thresholds so it's legible on every row without a heavy
 * i18n/relative-time dep.
 */
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
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
    });
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Build a query string from a subset of params, dropping empties.
 *  Keeps the tab/sort controls' URLs tidy: `/dashboard/clients?sort=alpha`
 *  instead of `/dashboard/clients?q=&view=&sort=alpha`. */
function buildQuery(params: {
  view?: string;
  q?: string;
  sort?: string;
}): string {
  const entries: Array<[string, string]> = [];
  if (params.view && params.view !== "active")
    entries.push(["view", params.view]);
  if (params.q) entries.push(["q", params.q]);
  if (params.sort && params.sort !== "recent") entries.push(["sort", params.sort]);
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}
