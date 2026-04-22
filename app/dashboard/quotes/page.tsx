import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money, dateShort } from "@/lib/format";
import { PageHeader, JobCard, EmptyState, StatusPillLink } from "@/components/ui";

export const metadata = { title: "Quotes — Rose Concrete" };

const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { status, q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  let builder = supabase
    .from("quotes")
    .select(
      "id, number, issued_at, valid_through, status, base_total, optional_total, accepted_total, archived_at, project:projects(id, name, client:clients(id, name))",
    )
    .is("archived_at", null) // hide archived quotes (cascaded from archived client)
    .order("issued_at", { ascending: false })
    .limit(200);

  if (status && (QUOTE_STATUSES as readonly string[]).includes(status)) {
    builder = builder.eq("status", status);
  }
  if (query) {
    builder = builder.or(`number.ilike.%${query}%,title.ilike.%${query}%`);
  }

  const { data: quotes } = await builder;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        subtitle={`${quotes?.length ?? 0} shown`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/quotes/quick"
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              ⚡ Quick quote
            </Link>
            <Link
              href="/dashboard/quotes/new"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            >
              + New quote
            </Link>
          </div>
        }
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          <StatusPillLink
            href={query ? `/dashboard/quotes?q=${encodeURIComponent(query)}` : "/dashboard/quotes"}
            active={!status}
            label="All"
          />
          {QUOTE_STATUSES.map((s: QuoteStatus) => {
            const params = new URLSearchParams();
            params.set("status", s);
            if (query) params.set("q", query);
            return (
              <StatusPillLink
                key={s}
                href={`/dashboard/quotes?${params.toString()}`}
                active={status === s}
                label={s}
              />
            );
          })}
        </div>
        <form
          method="get"
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
        >
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by number or title…"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Search
          </button>
          {(query || status) && (
            <Link
              href="/dashboard/quotes"
              className="px-2 text-sm text-neutral-500 hover:underline"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {quotes && quotes.length > 0 ? (
        <div className="grid gap-2">
          {quotes.map((q) => {
            const project = Array.isArray(q.project) ? q.project[0] : q.project;
            const client =
              project &&
              (Array.isArray(project.client) ? project.client[0] : project.client);
            const total =
              Number(q.accepted_total ?? 0) ||
              Number(q.base_total ?? 0) + Number(q.optional_total ?? 0);
            return (
              <JobCard
                key={q.id}
                href={`/dashboard/quotes/${q.id}`}
                title={`${q.number} — ${project?.name ?? "No project"}`}
                client={client?.name}
                meta={`Issued ${dateShort(q.issued_at)}`}
                status={q.status}
                right={
                  <div className="text-sm font-semibold text-neutral-900">
                    {money(total)}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No quotes match"
          description={
            query || status
              ? "Try clearing filters to see everything."
              : "Create one from a project."
          }
        />
      )}
    </div>
  );
}
