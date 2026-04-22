"use client";

/**
 * Typeahead client picker. Replaces the plain `<select>` dropdowns
 * that were previously used on quote / project / task / schedule
 * forms. Matches Jobber's pattern:
 *   - Empty box shows the 5 most recent clients by default.
 *   - As Ronnie types, the list filters against name / phone / email
 *     / city (300ms debounce so we're not hammering Supabase).
 *   - Persistent "+ New client" row at the bottom expands an inline
 *     create form — on submit the new client is selected + the
 *     combobox collapses.
 *
 * Value is the selected client's id, rendered into a hidden input so
 * the containing `<form>` picks it up transparently.
 *
 * Usage:
 *   <ClientCombobox name="client_id" required />
 *   <ClientCombobox name="client_id" initial={{id, name}} />
 */
import { useEffect, useRef, useState } from "react";
import {
  searchClientsAction,
  quickCreateClientAction,
  type ClientSummary,
} from "@/app/actions/clients";

type Props = {
  name: string;
  required?: boolean;
  placeholder?: string;
  initial?: { id: string; name: string } | null;
  /** Called with the selected client (or null on clear). Caller can
   *  wire this to auto-populate phone / email elsewhere in the form. */
  onSelect?: (client: ClientSummary | null) => void;
};

export function ClientCombobox({
  name,
  required,
  placeholder = "Search or pick a client…",
  initial = null,
  onSelect,
}: Props) {
  const [query, setQuery] = useState(initial?.name ?? "");
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
  } | null>(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Seed the "recent 5" list on first open.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchClientsAction(query)
        .then((rs) => setResults(rs))
        .finally(() => setLoading(false));
    }, query ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(c: ClientSummary) {
    setSelected({ id: c.id, name: c.name });
    setQuery(c.name);
    setOpen(false);
    setCreating(false);
    onSelect?.(c);
  }

  async function doCreate() {
    setError(null);
    const res = await quickCreateClientAction({
      name: query,
      phone: createPhone || null,
      email: createEmail || null,
      address: createAddress || null,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    pick(res.client);
    setCreatePhone("");
    setCreateEmail("");
    setCreateAddress("");
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setCreating(false);
    onSelect?.(null);
  }

  return (
    <div className="relative" ref={boxRef}>
      {/* Hidden input — value the form reads. */}
      <input
        type="hidden"
        name={name}
        value={selected?.id ?? ""}
        required={required}
      />
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setSelected(null);
            setOpen(true);
            if (!v) onSelect?.(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {selected && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          {!query && (
            <p className="border-b border-neutral-100 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Recent clients
            </p>
          )}
          {loading && (
            <p className="px-3 py-2 text-xs text-neutral-500">Searching…</p>
          )}
          {!loading && results.length === 0 && query && (
            <p className="px-3 py-2 text-xs text-neutral-500">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          )}
          {!loading &&
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                  selected?.id === c.id ? "bg-brand-50" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">
                    {c.name}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {[c.phone, c.email, c.city].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                </div>
              </button>
            ))}

          {/* Inline + New Client row — always visible at the bottom. */}
          <div className="border-t border-neutral-100 bg-neutral-50">
            {!creating ? (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setError(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                <span className="text-base leading-none">＋</span>
                New client{query ? ` "${query}"` : ""}
              </button>
            ) : (
              <div className="space-y-2 px-3 py-2 text-sm">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Client name *"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                {error && (
                  <p className="text-[11px] text-red-600">{error}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={doCreate}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Create client
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setError(null);
                    }}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
