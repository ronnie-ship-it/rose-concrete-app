import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money, dateShort } from "@/lib/format";
import { NewEntryForm } from "./new-entry-form";
import { SignOffRow } from "./sign-off-row";

export const metadata = { title: "Cash journal — Rose Concrete" };

/**
 * Cash journal for day laborers / tool rental / cash deliveries.
 * Accessible from both dashboard + crew app — RLS enforces that crew
 * only see their own rows.
 *
 * Query params:
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD  — date window (default: last 14d)
 *   ?worker=<name>                   — filter by worker
 *   ?export=pdf                      — prints the table (browser-to-PDF)
 */
type SearchParams = Promise<{ from?: string; to?: string; worker?: string }>;

export default async function CashJournalPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office", "crew"]);
  const { from, to, worker } = await searchParams;

  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const fromDate = (from ?? defaultFrom).slice(0, 10);
  const toDate = (to ?? defaultTo).slice(0, 10);

  const supabase = await createClient();

  let q = supabase
    .from("cash_journal_entries")
    .select(
      "id, entry_date, worker_name, kind, description, amount_cents, project_id, foreman_id, foreman_signed_at, notes, created_by, project:projects(name)",
    )
    .gte("entry_date", fromDate)
    .lte("entry_date", toDate)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (worker) q = q.ilike("worker_name", `%${worker}%`);
  const { data: rows } = await q;

  // Projects for the new-entry form's project picker.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = (rows ?? []).map((r) => ({
    ...r,
    project: Array.isArray(r.project) ? r.project[0] : r.project,
  }));

  // Weekly per-worker totals — bucket by ISO week (Mon-Sun).
  const perWorker = new Map<string, number>();
  const totalCents = entries.reduce((s, r) => {
    const cents = Number(r.amount_cents ?? 0);
    perWorker.set(
      r.worker_name as string,
      (perWorker.get(r.worker_name as string) ?? 0) + cents,
    );
    return s + cents;
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash journal"
        subtitle={`Day-laborer + tool-rental + delivery cash log. ${fromDate} → ${toDate}.`}
        actions={
          <Link
            // Carry the active filter through to the print view so the
            // exported PDF matches what's on screen.
            href={`/dashboard/cash-journal/print?${new URLSearchParams({
              from: fromDate,
              to: toDate,
              ...(worker ? { worker } : {}),
            }).toString()}`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            📄 Print / Export PDF
          </Link>
        }
      />

      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <Card className="no-print">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Log an entry
        </h2>
        <NewEntryForm projects={projects ?? []} />
      </Card>

      <form
        method="get"
        className="no-print flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-xs dark:border-brand-700 dark:bg-brand-800"
      >
        <label>
          <span className="block text-neutral-600 dark:text-neutral-300">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={fromDate}
            className="rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <label>
          <span className="block text-neutral-600 dark:text-neutral-300">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={toDate}
            className="rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <label>
          <span className="block text-neutral-600 dark:text-neutral-300">
            Worker
          </span>
          <input
            type="search"
            name="worker"
            defaultValue={worker ?? ""}
            placeholder="filter by name"
            className="rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700"
        >
          Apply
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total in window" value={money(totalCents / 100)} />
        <SummaryCard label="Entries" value={String(entries.length)} />
        <SummaryCard label="Workers" value={String(perWorker.size)} />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No cash entries in this window"
          description="Log one above or widen the date range."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-brand-700 dark:bg-brand-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Worker</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Foreman</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id as string}
                  className="border-b border-neutral-100 last:border-0 dark:border-brand-700"
                >
                  <td className="px-3 py-2 text-neutral-700 dark:text-neutral-200">
                    {dateShort(e.entry_date as string)}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {e.worker_name as string}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
                    {e.kind as string}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {e.project?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
                    {(e.description as string | null) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {money(Number(e.amount_cents ?? 0) / 100)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <SignOffRow
                      id={e.id as string}
                      signedAt={(e.foreman_signed_at as string | null) ?? null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-brand-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Weekly totals per worker
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {[...perWorker.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, cents]) => (
              <li
                key={name}
                className="flex items-center justify-between border-b border-neutral-100 py-1 last:border-0 dark:border-brand-700"
              >
                <span>{name}</span>
                <span className="font-semibold">{money(cents / 100)}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-brand-800">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
