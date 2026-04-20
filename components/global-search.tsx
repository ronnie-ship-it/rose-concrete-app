"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Hit = { id: string; name: string; meta: string };
type Results = {
  clients: Hit[];
  projects: Hit[];
  quotes: Hit[];
  requests: Hit[];
};

const EMPTY: Results = { clients: [], projects: [], quotes: [], requests: [] };

/**
 * Jobber-style global search in the dashboard top bar.
 *
 * - Press `/` anywhere to focus (unless focus is already in an input)
 * - Debounced 200ms
 * - Shows up to 5 hits per entity (Clients / Jobs / Quotes / Requests)
 * - Arrow keys move through hits; Enter opens the current one
 * - Esc clears / closes
 */
export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Keyboard shortcut: "/" focuses the search field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced fetch.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as Partial<Results> & { ok: boolean };
        if (!json.ok) return;
        setResults({
          clients: json.clients ?? [],
          projects: json.projects ?? [],
          quotes: json.quotes ?? [],
          requests: json.requests ?? [],
        });
        setOpen(true);
        setCursor(-1);
      } catch {
        // silent
      }
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q]);

  const flat: Array<{ href: string; label: string; meta: string; kind: string }> = [
    ...results.clients.map((h) => ({
      href: `/dashboard/clients/${h.id}`,
      label: h.name,
      meta: h.meta,
      kind: "Client",
    })),
    ...results.projects.map((h) => ({
      href: `/dashboard/projects/${h.id}`,
      label: h.name,
      meta: h.meta,
      kind: "Job",
    })),
    ...results.quotes.map((h) => ({
      href: `/dashboard/quotes/${h.id}`,
      label: h.name,
      meta: h.meta,
      kind: "Quote",
    })),
    ...results.requests.map((h) => ({
      href: `/dashboard/requests?status=all`,
      label: h.name,
      meta: h.meta,
      kind: "Request",
    })),
  ];

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQ("");
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      const picked = cursor >= 0 ? flat[cursor] : flat[0];
      if (picked) {
        e.preventDefault();
        router.push(picked.href);
        setQ("");
        setOpen(false);
      }
    }
  }

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          🔍
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onInputKey}
          placeholder="Search clients, jobs, quotes, requests…"
          className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-12 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          aria-label="Global search"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-500 sm:inline">
          /
        </kbd>
      </div>
      {open && flat.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          <ul>
            {flat.map((f, i) => (
              <li key={`${f.kind}-${f.href}-${f.label}`}>
                <Link
                  href={f.href}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    router.push(f.href);
                    setQ("");
                    setOpen(false);
                  }}
                  className={`flex items-start gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-0 ${
                    cursor === i ? "bg-brand-50" : "hover:bg-neutral-50"
                  }`}
                >
                  <span className="mt-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-600">
                    {f.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">
                      {f.label}
                    </p>
                    {f.meta && (
                      <p className="truncate text-xs text-neutral-500">
                        {f.meta}
                      </p>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && flat.length === 0 && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500 shadow-lg">
          No matches.
        </div>
      )}
    </div>
  );
}
