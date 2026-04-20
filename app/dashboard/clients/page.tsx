import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, JobCard, EmptyState } from "@/components/ui";

export const metadata = { title: "Clients — Rose Concrete" };

type SearchParams = Promise<{ q?: string; view?: string }>;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { q, view } = await searchParams;
  const query = (q ?? "").trim();
  // View tabs — default to active (archived_at is null). Archived
  // lives on its own tab so Ronnie can still dig into old records.
  const activeView = view === "archived" ? "archived" : "active";

  const supabase = await createClient();
  let builder = supabase
    .from("clients")
    .select("id, name, phone, email, city, source, created_at, archived_at")
    .order("created_at", { ascending: false })
    .limit(200);

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

      <div className="flex items-center gap-1 border-b border-neutral-200 text-sm">
        <Link
          href={`/dashboard/clients${query ? `?q=${encodeURIComponent(query)}` : ""}`}
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
          href={`/dashboard/clients?view=archived${query ? `&q=${encodeURIComponent(query)}` : ""}`}
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
        <div className="grid gap-2">
          {clients.map((c) => {
            const meta = [c.phone, c.email, c.city].filter(Boolean).join(" · ");
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
                    <span className="text-xs text-neutral-500">{c.source}</span>
                  ) : undefined
                }
              />
            );
          })}
        </div>
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
