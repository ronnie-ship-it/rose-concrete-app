import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { money, dateShort } from "@/lib/format";
import { QboUploadForm } from "./upload-form";

export const metadata = { title: "QBO Job Costing — Rose Concrete" };

export default async function QboSettingsPage() {
  await requireRole(["admin"]);
  const enabled = await isFeatureEnabled("qbo_job_costing");

  const supabase = await createClient();

  const [importsRes, unmatchedRes, totalsRes] = await Promise.all([
    supabase
      .from("qbo_imports")
      .select("id, filename, row_count, matched_count, skipped_count, created_at, notes")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("job_costs")
      .select("id", { count: "exact", head: true })
      .is("project_id", null),
    supabase
      .from("job_costs")
      .select("amount, project_id"),
  ]);

  const imports = importsRes.data ?? [];
  const unmatchedCount = unmatchedRes.count ?? 0;
  const allCosts = totalsRes.data ?? [];
  const totalCost = allCosts.reduce(
    (sum, r) => sum + Number(r.amount ?? 0),
    0
  );
  const totalMatched = allCosts
    .filter((r) => r.project_id !== null)
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Settings
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              QuickBooks job costing
            </h1>
            <p className="text-sm text-neutral-600">
              Import expense transactions from QuickBooks and see live
              per-project margin.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              enabled
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {enabled ? "Module enabled" : "Module disabled"}
          </span>
        </div>
      </div>

      {!enabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The <code>qbo_job_costing</code> feature flag is off. You can still
          import CSVs from this page for testing, but project pages and
          dashboard widgets won&apos;t show cost/margin to non-admins until the
          flag is flipped on in the <code>feature_flags</code> table.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total imported cost" value={money(totalCost)} />
        <StatCard
          label="Matched to a project"
          value={money(totalMatched)}
          subtle={`${
            totalCost > 0 ? Math.round((totalMatched / totalCost) * 100) : 0
          }% of total`}
        />
        <StatCard
          label="Unmatched costs"
          value={unmatchedCount.toLocaleString()}
          link={
            unmatchedCount > 0
              ? {
                  href: "/dashboard/settings/qbo/unmatched",
                  label: "Assign →",
                }
              : undefined
          }
        />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Upload a QBO export
        </h2>
        <QboUploadForm />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Recent imports
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-6 py-2">When</th>
                <th className="px-6 py-2">File</th>
                <th className="px-6 py-2 text-right">Rows</th>
                <th className="px-6 py-2 text-right">Matched</th>
                <th className="px-6 py-2 text-right">Skipped</th>
                <th className="px-6 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-neutral-100"
                >
                  <td className="px-6 py-2 text-neutral-700">
                    {dateShort(row.created_at as string)}
                  </td>
                  <td className="px-6 py-2 text-neutral-700">
                    {row.filename ?? "—"}
                  </td>
                  <td className="px-6 py-2 text-right text-neutral-700">
                    {row.row_count}
                  </td>
                  <td className="px-6 py-2 text-right text-neutral-700">
                    {row.matched_count}
                  </td>
                  <td className="px-6 py-2 text-right text-neutral-700">
                    {row.skipped_count}
                  </td>
                  <td className="px-6 py-2 text-xs text-neutral-500">
                    {row.notes ?? ""}
                  </td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-6 text-center text-sm text-neutral-500"
                  >
                    No imports yet. Upload your first QBO CSV above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtle,
  link,
}: {
  label: string;
  value: string;
  subtle?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-neutral-900">{value}</div>
      {subtle && (
        <div className="mt-1 text-xs text-neutral-500">{subtle}</div>
      )}
      {link && (
        <Link
          href={link.href}
          className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}
