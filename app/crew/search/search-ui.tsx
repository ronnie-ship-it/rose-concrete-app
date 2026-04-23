"use client";

/**
 * Search UI — client component. Filter pills at top, search input
 * below, scrollable list of results. Typing updates the URL after
 * a 300ms debounce so back-button replays the last search.
 *
 * Pills: [Clients] [Requests] [Quotes] [Jobs]
 *   - Tapping a pill toggles it (clearing back to "all" on re-tap).
 *   - Selected pill = primary green solid.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  kind: "client" | "project" | "quote" | "lead";
  label: string;
  subtitle: string | null;
  date: string | null;
  status: string | null;
  href: string;
};

type Kind = "clients" | "requests" | "quotes" | "jobs";

const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "clients", label: "Clients" },
  { value: "requests", label: "Requests" },
  { value: "quotes", label: "Quotes" },
  { value: "jobs", label: "Jobs" },
];

const KIND_ICON: Record<Row["kind"], string> = {
  client: "👤",
  project: "🧱",
  quote: "📄",
  lead: "📬",
};

export function SearchUI({
  initialQuery,
  activeKind,
  rows,
}: {
  initialQuery: string;
  activeKind: Kind | null;
  rows: Row[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  // Push the query into the URL on 300ms idle so server can refilter.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q === initialQuery) return;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (activeKind) params.set("kind", activeKind);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : `/crew/search`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, activeKind, initialQuery, router]);

  function togglePill(next: Kind) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activeKind !== next) params.set("kind", next);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : `/crew/search`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-[#1a2332] dark:text-white">
        Search
      </h1>

      {/* Filter pills */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {KINDS.map((k) => {
          const active = activeKind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => togglePill(k.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                active
                  ? "bg-[#4A7C59] text-white"
                  : "bg-white text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Search box */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients, jobs, quotes, requests…"
          className="block w-full rounded-full border border-neutral-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm focus:border-[#4A7C59] focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          autoFocus
        />
      </div>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-neutral-800">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            {q ? `No matches for "${q}"` : "Start typing to search."}
          </p>
        </div>
      ) : (
        <>
          {!q && (
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Recently active
            </p>
          )}
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {rows.slice(0, 50).map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link
                  href={r.href}
                  className="flex min-h-[60px] items-center gap-3 px-4 py-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-lg dark:bg-neutral-700">
                    {KIND_ICON[r.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                      {r.label}
                    </p>
                    {r.subtitle && (
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {r.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {r.date && (
                      <p className="text-[10px] text-neutral-400">
                        {new Date(r.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                    {r.status && (
                      <p className="mt-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                        {r.status.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
