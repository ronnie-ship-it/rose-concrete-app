import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, dateShort } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "Cash journal — Print",
  robots: { index: false },
};

type SearchParams = Promise<{ from?: string; to?: string; worker?: string }>;

/** Print-to-PDF version of the cash journal. Same window params. */
export default async function CashJournalPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
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
      "id, entry_date, worker_name, kind, description, amount_cents, foreman_signed_at, notes, project:projects(name)",
    )
    .gte("entry_date", fromDate)
    .lte("entry_date", toDate)
    .order("entry_date", { ascending: true });
  if (worker) q = q.ilike("worker_name", `%${worker}%`);
  const { data: rows } = await q;

  const entries = (rows ?? []).map((r) => ({
    ...r,
    project: Array.isArray(r.project) ? r.project[0] : r.project,
  }));
  const total = entries.reduce(
    (s, r) => s + Number(r.amount_cents ?? 0),
    0,
  );

  return (
    <div className="statement mx-auto max-w-3xl bg-white p-8 text-neutral-900">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          .statement { padding: 0 !important; }
        }
        .statement table { width: 100%; border-collapse: collapse; }
        .statement th, .statement td { padding: 6px 8px; text-align: left; }
        .statement th { border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; color: #555; }
        .statement td { border-bottom: 1px solid #f3f3f3; font-size: 13px; }
        .statement .right { text-align: right; }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <a
          href="/dashboard/cash-journal"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Back
        </a>
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-neutral-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Rose Concrete
        </p>
        <h1 className="mt-1 text-2xl font-bold">Cash journal</h1>
        <p className="text-xs text-neutral-600">
          {fromDate} → {toDate}
          {worker ? ` · worker "${worker}"` : ""}
        </p>
      </header>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Worker</th>
            <th>Kind</th>
            <th>Job</th>
            <th>Description</th>
            <th className="right">Amount</th>
            <th>Signed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id as string}>
              <td>{dateShort(e.entry_date as string)}</td>
              <td>{e.worker_name as string}</td>
              <td>{e.kind as string}</td>
              <td>{e.project?.name ?? "—"}</td>
              <td>{(e.description as string | null) ?? ""}</td>
              <td className="right">
                {money(Number(e.amount_cents ?? 0) / 100)}
              </td>
              <td>
                {e.foreman_signed_at
                  ? dateShort(e.foreman_signed_at as string)
                  : "—"}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} className="right" style={{ fontWeight: 600 }}>
              Total
            </td>
            <td className="right" style={{ fontWeight: 600 }}>
              {money(total / 100)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      <footer className="mt-10 border-t border-neutral-200 pt-3 text-center text-[11px] text-neutral-500">
        Rose Concrete — internal cash journal. Keep with weekly payroll
        records.
      </footer>
    </div>
  );
}
