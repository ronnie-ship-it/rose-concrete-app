import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { money } from "@/lib/format";
import { PageHeader, JobCard, EmptyState, StatusPillLink } from "@/components/ui";
import { PROJECT_STATUSES } from "./constants";

export const metadata = { title: "Jobs — Rose Concrete" };

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { status, q } = await searchParams;
  const query = (q ?? "").trim();

  const showMargin = await isFeatureEnabled("qbo_job_costing");

  const supabase = await createClient();
  let builder = supabase
    .from("projects")
    .select(
      "id, name, location, status, sqft, revenue_cached, cost_cached, margin_cached, created_at, archived_at, client:clients(id, name)"
    )
    .is("archived_at", null) // hide archived projects by default (cascade from client archive)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) {
    builder = builder.eq("status", status);
  }
  if (query) {
    builder = builder.or(
      `name.ilike.%${query}%,location.ilike.%${query}%`
    );
  }

  const { data: projects, error } = await builder;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle={`${projects?.length ?? 0} total`}
        actions={
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            + New job
          </Link>
        }
      />

      {/* Jobber-style status filter pills + search */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          <StatusPillLink
            href={query ? `/dashboard/projects?q=${encodeURIComponent(query)}` : "/dashboard/projects"}
            active={!status}
            label="All"
          />
          {PROJECT_STATUSES.map((s) => {
            const params = new URLSearchParams();
            params.set("status", s);
            if (query) params.set("q", query);
            return (
              <StatusPillLink
                key={s}
                href={`/dashboard/projects?${params.toString()}`}
                active={status === s}
                label={s.replace(/_/g, " ")}
              />
            );
          })}
        </div>
        <form
          method="get"
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
        >
          {status && (
            <input type="hidden" name="status" value={status} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name or location…"
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
              href="/dashboard/projects"
              className="px-2 text-sm text-neutral-500 hover:underline"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {projects && projects.length > 0 ? (
        <div className="grid gap-2">
          {projects.map((p) => {
            const clientRel = Array.isArray(p.client) ? p.client[0] : p.client;
            const meta = [p.location, p.sqft ? `${p.sqft} sqft` : null]
              .filter(Boolean)
              .join(" · ");
            const right =
              showMargin && (Number(p.revenue_cached) || Number(p.cost_cached)) ? (
                <div>
                  <div className="text-sm font-semibold text-neutral-900">
                    {money(p.revenue_cached)}
                  </div>
                  <div
                    className={`text-xs ${
                      Number(p.margin_cached) < 0
                        ? "text-red-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {money(p.margin_cached)} margin
                  </div>
                </div>
              ) : undefined;
            return (
              <JobCard
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                title={p.name}
                client={clientRel?.name}
                meta={meta || undefined}
                status={p.status}
                right={right}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No jobs match"
          description={
            query || status
              ? "Try clearing filters to see everything."
              : "Create your first job from a client's quote."
          }
        />
      )}
    </div>
  );
}
