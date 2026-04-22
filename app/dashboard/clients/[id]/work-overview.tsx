"use client";

/**
 * Client detail → "Work overview" tabbed table. Matches Jobber's
 * inline filter bar at `/clients/{id}`:
 *
 *   [Active] [All] [Requests] [Quotes] [Jobs] [Invoices]
 *
 * All work items — requests/leads, quotes, projects, invoices
 * (milestones) — render in one table with columns: Item | Date |
 * Status | Amount. Click a row to open the detail page. The Active
 * tab filters to in-flight statuses (Jobber's default); the others
 * are type-scoped.
 *
 * Parent server component pre-loads all rows. This client renders
 * the tabs + filters in memory — no server round-trip per tab switch.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { money, dateShort } from "@/lib/format";

export type WorkItem = {
  id: string;
  kind: "request" | "quote" | "project" | "invoice";
  label: string;
  href: string;
  date: string | null;
  status: string;
  amount: number | null;
};

type TabKey = "active" | "all" | "request" | "quote" | "project" | "invoice";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
  { key: "request", label: "Requests" },
  { key: "quote", label: "Quotes" },
  { key: "project", label: "Jobs" },
  { key: "invoice", label: "Invoices" },
];

/** Which statuses count as "active" for the default tab. Mirrors
 *  Jobber's active filter — draft/sent/new/approved/scheduled live
 *  in Active; completed/paid/archived/declined don't. */
const ACTIVE_STATUSES = new Set([
  "new",
  "contacted",
  "qualified",
  "draft",
  "sent",
  "awaiting_response",
  "approved",
  "accepted",
  "scheduled",
  "active",
  "pending",
  "due",
  "overdue",
  "in_progress",
  "quoting",
  "lead",
]);

export function ClientWorkOverview({ items }: { items: WorkItem[] }) {
  const [tab, setTab] = useState<TabKey>("active");

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "active")
      return items.filter((i) => ACTIVE_STATUSES.has(i.status.toLowerCase()));
    return items.filter((i) => i.kind === tab);
  }, [tab, items]);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-brand-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Work overview
        </h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-100 px-3 py-1 text-sm dark:border-brand-700">
        {TABS.map((t) => {
          const count =
            t.key === "all"
              ? items.length
              : t.key === "active"
                ? items.filter((i) =>
                    ACTIVE_STATUSES.has(i.status.toLowerCase()),
                  ).length
                : items.filter((i) => i.kind === t.key).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-brand-600 text-brand-700 dark:text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-600 dark:bg-brand-700 dark:text-neutral-200"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
          No items in this view.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-brand-700 dark:bg-brand-900 dark:text-neutral-400">
            <tr>
              <th className="px-5 py-2">Item</th>
              <th className="px-5 py-2">Date</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr
                key={`${it.kind}-${it.id}`}
                className="border-b border-neutral-100 last:border-0 dark:border-brand-700"
              >
                <td className="px-5 py-3">
                  <Link
                    href={it.href}
                    className="inline-flex items-center gap-2 text-brand-700 hover:underline dark:text-white"
                  >
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        background: kindColor(it.kind).bg,
                        color: kindColor(it.kind).fg,
                      }}
                    >
                      {it.kind}
                    </span>
                    <span className="font-medium">{it.label}</span>
                  </Link>
                </td>
                <td className="px-5 py-3 text-xs text-neutral-600 dark:text-neutral-300">
                  {it.date ? dateShort(it.date) : "—"}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-neutral-700 dark:bg-brand-700 dark:text-neutral-200">
                    {it.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold">
                  {it.amount != null ? money(it.amount) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function kindColor(k: WorkItem["kind"]): { bg: string; fg: string } {
  switch (k) {
    case "request":
      return { bg: "#fef3c7", fg: "#92400e" }; // amber
    case "quote":
      return { bg: "#fce7f3", fg: "#9d174d" }; // pink
    case "project":
      return { bg: "#d1fae5", fg: "#065f46" }; // emerald
    case "invoice":
      return { bg: "#dbeafe", fg: "#1e40af" }; // sky
  }
}
