import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { CrewCreateChrome } from "../../create/chrome";
import { money } from "@/lib/format";

export const metadata = { title: "Link a job — Rose Concrete" };

type SearchParams = Promise<{ q?: string; ret?: string }>;

/**
 * Project / job picker — opened from the "Linked job" button on the
 * New Expense flow (and anywhere else we want to attach an expense or
 * task to an existing project).
 *
 * Mirrors the client picker layout. After selection, we append
 * `?project_id=…` to the originating form path.
 */
export default async function PickProject({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const ret = sp.ret ?? null;

  const supabase = await createClient();
  let builder = supabase
    .from("projects")
    .select(
      "id, name, status, revenue_cached, service_address, location, updated_at, client:clients(name)",
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (q.length >= 1) {
    const pat = `%${q}%`;
    builder = builder.or(
      `name.ilike.${pat},service_address.ilike.${pat},location.ilike.${pat}`,
    );
  }

  const { data: projects } = await builder;

  return (
    <CrewCreateChrome
      title="Link a job"
      saveLabel="Cancel"
      saveHref={ret ?? "/crew"}
    >
      <form method="get" className="px-4 pt-4">
        {ret && <input type="hidden" name="ret" value={ret} />}
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search jobs"
            className="block w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-base text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
      </form>

      <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {q ? `Matching "${q}"` : "Recent jobs"}
      </p>

      {!projects || projects.length === 0 ? (
        <div className="px-4 pt-3">
          <div className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No jobs match. Tap Cancel below to go back.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100 px-4 dark:divide-neutral-700">
          {projects.map((p) => {
            const client = p.client
              ? Array.isArray(p.client)
                ? p.client[0]
                : p.client
              : null;
            const href = ret
              ? `${ret}${ret.includes("?") ? "&" : "?"}project_id=${p.id}`
              : `/crew/projects/${p.id}`;
            return (
              <li key={p.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-[#1A7B40]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {[client?.name, p.service_address ?? p.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {Number(p.revenue_cached ?? 0) > 0 && (
                    <p className="shrink-0 text-sm font-bold text-[#1a2332] dark:text-white">
                      {money(Number(p.revenue_cached))}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CrewCreateChrome>
  );
}
