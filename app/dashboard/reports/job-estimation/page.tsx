import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import {
  loadPhaseDurations,
  loadTotalEstimates,
  bucketLabel,
  type SqftBucket,
  type TotalEstimate,
  type PhaseDuration,
} from "@/lib/job-estimation";

export const metadata = { title: "Job estimation — Rose Concrete" };

type SearchParams = Promise<{ service?: string; bucket?: string }>;

/**
 * Job estimation intelligence. Cross-references completed jobs
 * grouped by service_type × sqft bucket to answer "what should a
 * 500 sqft stamped driveway cost / take?"
 *
 * Filters:
 *   ?service=driveway&bucket=md — narrow to the (driveway, 1000-1999)
 *   group to see phase-by-phase averages.
 *
 * The dataset grows every time a project completes — over time the
 * confidence scores (sample size ≥ 10) move from "extrapolation" to
 * "anchored in real history".
 */
export default async function JobEstimationReport({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { service, bucket } = await searchParams;

  const [totals, phaseRows] = await Promise.all([
    loadTotalEstimates(),
    loadPhaseDurations(),
  ]);

  // Unique service types in the data.
  const serviceTypes = Array.from(
    new Set(totals.map((t) => t.service_type)),
  ).sort();

  // Service/bucket filter state.
  const selectedService = service && serviceTypes.includes(service) ? service : null;
  const selectedBucket = ((): SqftBucket | null => {
    const b = bucket ?? "";
    return (["xs", "sm", "md", "lg"] as SqftBucket[]).includes(b as SqftBucket)
      ? (b as SqftBucket)
      : null;
  })();

  // Filtered totals view.
  const filteredTotals = totals
    .filter((t) => !selectedService || t.service_type === selectedService)
    .filter((t) => !selectedBucket || t.sqft_bucket === selectedBucket)
    .sort((a, b) =>
      a.service_type === b.service_type
        ? BUCKET_ORDER.indexOf(a.sqft_bucket) - BUCKET_ORDER.indexOf(b.sqft_bucket)
        : a.service_type.localeCompare(b.service_type),
    );

  const phaseRowsForSelection =
    selectedService && selectedBucket
      ? phaseRows
          .filter(
            (p) =>
              p.service_type === selectedService &&
              p.sqft_bucket === selectedBucket,
          )
          .sort((a, b) => phaseOrderOf(a.phase_kind) - phaseOrderOf(b.phase_kind))
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job estimation intelligence"
        subtitle="Historical averages per service type × size. Improves every time a job completes."
      />

      {totals.length === 0 ? (
        <EmptyState
          title="Not enough data yet"
          description="Complete a few jobs with a service_type, sqft, and revenue captured. Once projects flip to done and phases have start/end dates, the rollup populates here."
        />
      ) : (
        <>
          {/* Filter bar */}
          <Card>
            <form className="flex flex-wrap items-end gap-3 text-sm">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Service type
                </span>
                <select
                  name="service"
                  defaultValue={selectedService ?? ""}
                  className="mt-1 rounded-md border border-neutral-300 px-2 py-1.5"
                >
                  <option value="">All</option>
                  {serviceTypes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Size
                </span>
                <select
                  name="bucket"
                  defaultValue={selectedBucket ?? ""}
                  className="mt-1 rounded-md border border-neutral-300 px-2 py-1.5"
                >
                  <option value="">All sizes</option>
                  <option value="xs">{bucketLabel("xs")}</option>
                  <option value="sm">{bucketLabel("sm")}</option>
                  <option value="md">{bucketLabel("md")}</option>
                  <option value="lg">{bucketLabel("lg")}</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Apply
              </button>
              {(selectedService || selectedBucket) && (
                <Link
                  href="/dashboard/reports/job-estimation"
                  className="text-xs text-neutral-500 hover:underline"
                >
                  Clear filter
                </Link>
              )}
            </form>
          </Card>

          {/* Totals table */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Totals — all phases combined
            </h2>
            {filteredTotals.length === 0 ? (
              <Card>
                <p className="text-sm text-neutral-600">
                  No completed jobs match the selected filter.
                </p>
              </Card>
            ) : (
              <Card className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-brand-700 dark:bg-brand-900 dark:text-neutral-400">
                    <tr>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2 text-right">N</th>
                      <th className="px-3 py-2 text-right">Avg sqft</th>
                      <th className="px-3 py-2 text-right">Avg price</th>
                      <th className="px-3 py-2 text-right">$/sqft</th>
                      <th className="px-3 py-2 text-right">Range</th>
                      <th className="px-3 py-2 text-right">Avg days</th>
                      <th className="px-3 py-2 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTotals.map((t) => {
                      const confidence = Math.min(t.sample_size / 10, 1);
                      const tone =
                        confidence >= 1
                          ? "bg-emerald-100 text-emerald-900"
                          : confidence >= 0.5
                            ? "bg-amber-100 text-amber-900"
                            : "bg-neutral-100 text-neutral-700";
                      return (
                        <tr
                          key={`${t.service_type}-${t.sqft_bucket}`}
                          className="border-b border-neutral-100 last:border-0 dark:border-brand-700"
                        >
                          <td className="px-3 py-2 font-medium">
                            <Link
                              href={`/dashboard/reports/job-estimation?service=${encodeURIComponent(t.service_type)}&bucket=${t.sqft_bucket}`}
                              className="text-brand-700 hover:underline"
                            >
                              {t.service_type}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {bucketLabel(t.sqft_bucket)}
                          </td>
                          <td className="px-3 py-2 text-right">{t.sample_size}</td>
                          <td className="px-3 py-2 text-right">
                            {t.avg_sqft ? Math.round(t.avg_sqft).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {t.avg_revenue ? money(t.avg_revenue) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {t.avg_price_per_sqft
                              ? `$${t.avg_price_per_sqft.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            {t.min_revenue && t.max_revenue
                              ? `${money(t.min_revenue)} – ${money(t.max_revenue)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {t.avg_total_days ? `${Math.round(t.avg_total_days)}d` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
                              title={`${t.sample_size} sample${t.sample_size === 1 ? "" : "s"} — 10+ = full confidence`}
                            >
                              {Math.round(confidence * 100)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </section>

          {/* Phase breakdown — only when a specific service + bucket is selected */}
          {selectedService && selectedBucket && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Per-phase breakdown — {selectedService},{" "}
                {bucketLabel(selectedBucket)}
              </h2>
              {phaseRowsForSelection.length === 0 ? (
                <Card>
                  <p className="text-sm text-neutral-600">
                    No phase-level data yet for this filter. Phase hours
                    get stamped when crew clocks out on a visit that
                    falls inside the phase&apos;s date range.
                  </p>
                </Card>
              ) : (
                <Card className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-brand-700 dark:bg-brand-900 dark:text-neutral-400">
                      <tr>
                        <th className="px-3 py-2">Phase</th>
                        <th className="px-3 py-2 text-right">N</th>
                        <th className="px-3 py-2 text-right">Avg hours</th>
                        <th className="px-3 py-2 text-right">Avg days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseRowsForSelection.map((p) => (
                        <tr
                          key={p.phase_kind}
                          className="border-b border-neutral-100 last:border-0 dark:border-brand-700"
                        >
                          <td className="px-3 py-2 capitalize">{p.phase_kind}</td>
                          <td className="px-3 py-2 text-right">{p.sample_size}</td>
                          <td className="px-3 py-2 text-right">
                            {p.avg_hours ? `${p.avg_hours.toFixed(1)}h` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {p.avg_days ? `${Math.round(p.avg_days)}d` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>
          )}
        </>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-500 shadow-sm dark:border-brand-700 dark:bg-brand-800">
        <strong>How this works.</strong> Every job that completes with
        a <code>service_type</code>, <code>sqft</code>, and{" "}
        <code>revenue_cached</code> populates the rollup. Sqft buckets
        are xs (&lt;500), sm (500-999), md (1k-1999), lg (2k+) so a
        500sqft estimate isn&apos;t skewed by a 3000sqft job. Phase
        durations come from <code>visit_time_entries</code> — the
        clock-in/out totals are summed per project_phase via the{" "}
        <code>compute_phase_durations</code> trigger.
      </div>
    </div>
  );
}

const BUCKET_ORDER: SqftBucket[] = ["xs", "sm", "md", "lg"];

function phaseOrderOf(kind: string): number {
  const order = ["demo", "prep", "pour", "cleanup", "inspection", "custom"];
  const idx = order.indexOf(kind);
  return idx === -1 ? 99 : idx;
}

// Re-export types (unused by the page but consumed by link prefetch).
export type { TotalEstimate, PhaseDuration };
