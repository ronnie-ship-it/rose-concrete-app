import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { CrewCreateChrome } from "../../create/chrome";

export const metadata = { title: "Pick a client — Rose Concrete" };

type SearchParams = Promise<{ q?: string; ret?: string }>;

/**
 * Client picker — opened from any "Select Existing Client" button in
 * the crew create flows. Shows the recent / matching clients in a
 * tappable list.
 *
 * `?ret=` is the path to return to after selection. We append
 * `?client_id=…` to that path so the originating form can pre-fill.
 *
 * Without a `ret`, picking a row drops you straight onto the client
 * detail page — handy when crew taps an "Add from Contacts" -style
 * button just to jump to a client.
 */
export default async function PickClient({
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
    .from("clients")
    .select("id, name, phone, email, city, updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (q.length >= 1) {
    const pat = `%${q}%`;
    builder = builder.or(
      `name.ilike.${pat},phone.ilike.${pat},email.ilike.${pat},city.ilike.${pat}`,
    );
  }

  const { data: clients } = await builder;

  return (
    <CrewCreateChrome
      title="Select a client"
      saveLabel="Add new client"
      saveHref={`/crew/create/client${ret ? `?ret=${encodeURIComponent(ret)}` : ""}`}
    >
      {/* Search */}
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
            placeholder="Search clients"
            className="block w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-base text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
      </form>

      <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {q ? `Matching "${q}"` : "Recent clients"}
      </p>

      {!clients || clients.length === 0 ? (
        <div className="px-4 pt-3">
          <div className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No clients match. Use{" "}
              <span className="font-bold text-[#1A7B40]">Add new client</span>{" "}
              below.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100 px-4 dark:divide-neutral-700">
          {clients.map((c) => {
            // Where to go on tap: if a `ret` was given, append the
            // client ID to that destination so the originating form
            // pre-fills. Otherwise drop into the client detail page.
            const href = ret
              ? `${ret}${ret.includes("?") ? "&" : "?"}client_id=${c.id}`
              : `/crew/clients/${c.id}`;
            return (
              <li key={c.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-sm font-bold text-[#1A7B40]">
                    {(c.name ?? "?")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((s: string) => s[0]?.toUpperCase() ?? "")
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                      {c.name}
                    </p>
                    {(c.phone || c.email || c.city) && (
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {[c.phone, c.email, c.city].filter(Boolean).join(" · ")}
                      </p>
                    )}
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
