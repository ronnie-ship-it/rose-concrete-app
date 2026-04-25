"use client";

/**
 * Search UI — Jobber mobile parity (Apr 2026 screenshots).
 *
 *   ┌─ Search ─────────────────────────┐
 *   │ 🔍 Search                         │   rounded gray pill input
 *   │                                   │
 *   │ ( 👤 Clients ) ( 📥 Requests ) … │   horizontal-scroll filter chips
 *   │                                   │
 *   │ Recently active                   │
 *   │ 👤 Richard Wright           Lead │
 *   │    Today | 4505 Coronado Avenue   │
 *   │ 👤 Julie Hastings           Lead │
 *   │    Today | 4928 35th Street       │
 *   │ 📥 Julie Hastings            New │
 *   │    Today | Quo Request            │
 *   │ 🔍 Dottie Davis        Converted │
 *   │    Apr 23 | $6.5k | Quote #121    │
 *   │ 🔨 Dottie Davis        Upcoming  │
 *   │    Apr 23 | $6.5k | Sidewalk …    │
 *   │ …                                 │
 *   └───────────────────────────────────┘
 *
 * Status chip palette (from screenshots):
 *   Lead       → light blue   #3B82F6 / square chip
 *   New        → yellow       #E8B74A
 *   Converted  → dark navy    #1a2332 (white text)
 *   Upcoming   → blue         #3B82F6 (lighter)
 *   anything else → neutral gray
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

const KINDS: Array<{
  value: Kind;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    value: "clients",
    label: "Clients",
    icon: <ChipIcon path="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />,
  },
  {
    value: "requests",
    label: "Requests",
    icon: <ChipIcon path="M3 12V5h18v7M3 12l3 7h12l3-7" tone="gold" />,
  },
  {
    value: "quotes",
    label: "Quotes",
    icon: (
      <ChipIcon
        path="M7 4h8l4 4v8M5 4h2v16h12v-2M11 11a2.5 2.5 0 1 0 0 5M13 13l2 2"
        tone="pink"
      />
    ),
  },
  {
    value: "jobs",
    label: "Jobs",
    icon: (
      <ChipIcon
        path="M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z"
        tone="green"
      />
    ),
  },
];

function ChipIcon({ path, tone }: { path: string; tone?: "gold" | "pink" | "green" }) {
  const color =
    tone === "gold"
      ? "#E8B74A"
      : tone === "pink"
        ? "#D46B7E"
        : tone === "green"
          ? "#1A7B40"
          : "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

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
      {/* Search box — Jobber-style rounded gray pill */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
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
          placeholder="Search"
          className="block w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-base text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
      </div>

      {/* Filter chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {KINDS.map((k) => {
          const active = activeKind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => togglePill(k.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                active
                  ? "bg-[#1a2332] text-white"
                  : "bg-neutral-100 text-[#1a2332] dark:bg-neutral-800 dark:text-white"
              }`}
            >
              {k.icon}
              <span>{k.label}</span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {!q && rows.length > 0 && (
        <p className="pt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Recently active
        </p>
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-neutral-800">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            {q ? `No matches for "${q}"` : "Start typing to search."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {rows.slice(0, 50).map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <Link
                href={r.href}
                className="flex items-center gap-3 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
              >
                <RowIcon kind={r.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
                    {r.label}
                  </p>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {formatSubtitle(r)}
                  </p>
                </div>
                {r.status && <StatusChip status={r.status} kind={r.kind} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowIcon({ kind }: { kind: Row["kind"] }) {
  const cfg: Record<Row["kind"], { color: string; path: string }> = {
    client: {
      color: "#1a2332",
      path: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6",
    },
    lead: {
      color: "#E8B74A",
      path: "M3 12V5h18v7M3 12l3 7h12l3-7M9 12h6",
    },
    quote: {
      color: "#D46B7E",
      path: "M7 4h8l4 4v8M5 4h2v16h12v-2M11 11a2.5 2.5 0 1 0 0 5M13 13l2 2",
    },
    project: {
      color: "#1A7B40",
      path: "M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z",
    },
  };
  const { color, path } = cfg[kind];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    </span>
  );
}

function formatSubtitle(r: Row): string {
  const parts: string[] = [];
  if (r.date) parts.push(formatRelativeDay(r.date));
  if (r.subtitle) parts.push(r.subtitle);
  return parts.join(" | ") || "—";
}

function formatRelativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return "Today";
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusChip({ status, kind }: { status: string; kind: Row["kind"] }) {
  // Map raw status strings to chip presentation. The mapping is rough on
  // purpose — we just need broad color buckets matching Jobber.
  const lower = status.toLowerCase();
  let bg = "#E5E7EB"; // neutral
  let text = "#1a2332";
  let label = lower;

  if (kind === "lead") {
    if (lower === "new") {
      bg = "#E8B74A";
      text = "#1a2332";
      label = "New";
    } else if (lower === "converted") {
      bg = "#1a2332";
      text = "#FFFFFF";
      label = "Converted";
    } else {
      bg = "#3B82F6";
      text = "#FFFFFF";
      label = "Lead";
    }
  } else if (kind === "client") {
    bg = "#3B82F6";
    text = "#FFFFFF";
    label = "Lead";
  } else if (kind === "quote") {
    if (lower === "accepted") {
      bg = "#1a2332";
      text = "#FFFFFF";
      label = "Converted";
    } else if (lower === "draft") {
      bg = "#E8B74A";
      text = "#1a2332";
      label = "Draft";
    } else {
      bg = "#3B82F6";
      text = "#FFFFFF";
      label = "Quote";
    }
  } else if (kind === "project") {
    if (lower === "done" || lower === "completed") {
      bg = "#1a2332";
      text = "#FFFFFF";
      label = "Conv";
    } else {
      bg = "#3B82F6";
      text = "#FFFFFF";
      label = "Upcoming";
    }
  }

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-bold capitalize"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  );
}
