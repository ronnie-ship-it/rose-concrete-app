import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { CrewCreateChrome } from "../../create/chrome";

export const metadata = { title: "Pick team — Rose Concrete" };

type SearchParams = Promise<{ q?: string; ret?: string }>;

/**
 * Team picker — opened from the "Team" row on New Task / New Job /
 * etc. Loads every profile whose role is `crew` or `admin` (`office`
 * staff aren't on jobsite teams) and lets you tap to assign.
 *
 * Single-select for now; if a form ever needs multi-select we can
 * add `?multi=1` and stash the chosen IDs in the URL query.
 */
export default async function PickTeam({
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
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["crew", "admin"])
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true })
    .limit(60);

  if (q.length >= 1) {
    const pat = `%${q}%`;
    builder = builder.or(`full_name.ilike.${pat},email.ilike.${pat}`);
  }

  const { data: profiles } = await builder;

  return (
    <CrewCreateChrome
      title="Pick team"
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
            placeholder="Search team"
            className="block w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-base text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
      </form>

      <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Crew & admins ({profiles?.length ?? 0})
      </p>

      {!profiles || profiles.length === 0 ? (
        <div className="px-4 pt-3">
          <div className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No crew or admin members are loaded yet. Add team in
              Settings → Manage team.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100 px-4 dark:divide-neutral-700">
          {profiles.map((p) => {
            const display = p.full_name?.trim() || p.email.split("@")[0];
            const initials = display
              .split(/\s+/)
              .slice(0, 2)
              .map((s: string) => s[0]?.toUpperCase() ?? "")
              .join("");
            const href = ret
              ? `${ret}${ret.includes("?") ? "&" : "?"}user_id=${p.id}`
              : `/crew`;
            return (
              <li key={p.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a2332] text-sm font-bold text-white">
                    {initials || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                      {display}
                    </p>
                    <p className="truncate text-xs capitalize text-neutral-500 dark:text-neutral-400">
                      {p.role}
                      {p.email && p.email !== display && ` · ${p.email}`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CrewCreateChrome>
  );
}
