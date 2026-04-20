/**
 * Smart-estimate chip shown on the quote detail page. Compares the
 * quote's current total to the historical average for similar jobs
 * (same service_type, same sqft bucket) and surfaces:
 *   - Suggested price range (low / avg / high)
 *   - Confidence score (based on sample size)
 *   - Flag if the quote is significantly above or below history
 *
 * Pure server component — loads estimation data from lib/job-estimation
 * and renders once per quote render. No interactivity, no state.
 */
import { money } from "@/lib/format";
import { evaluateQuotePrice, bucketLabel } from "@/lib/job-estimation";

export async function SmartEstimateChip({
  serviceType,
  sqft,
  proposedPrice,
}: {
  serviceType: string | null;
  sqft: number | null;
  proposedPrice: number;
}) {
  if (!serviceType || !sqft || sqft <= 0) return null;

  const res = await evaluateQuotePrice({ serviceType, sqft, proposedPrice });
  if (!res) return null;
  const { tone, message, suggestion } = res;

  const toneClasses = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    alert: "border-red-200 bg-red-50 text-red-900",
  }[tone];

  const toneIcon = { ok: "✓", warning: "⚠", alert: "⚠" }[tone];

  return (
    <section className={`rounded-lg border p-4 text-sm ${toneClasses}`}>
      <div className="flex items-start gap-3">
        <span className="text-base font-bold">{toneIcon}</span>
        <div className="flex-1 space-y-2">
          <p className="font-semibold">{message}</p>
          {suggestion && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <dt className="font-semibold">Suggested</dt>
                <dd>
                  {suggestion.suggestedPrice
                    ? money(suggestion.suggestedPrice)
                    : "—"}
                </dd>
              </div>
              {suggestion.priceLow != null && suggestion.priceHigh != null && (
                <div>
                  <dt className="font-semibold">Range</dt>
                  <dd>
                    {money(suggestion.priceLow)} – {money(suggestion.priceHigh)}
                  </dd>
                </div>
              )}
              {suggestion.pricePerSqft != null && (
                <div>
                  <dt className="font-semibold">$/sqft</dt>
                  <dd>${suggestion.pricePerSqft.toFixed(2)}</dd>
                </div>
              )}
              {suggestion.daysEstimate != null && (
                <div>
                  <dt className="font-semibold">Est. days</dt>
                  <dd>{suggestion.daysEstimate}d</dd>
                </div>
              )}
            </dl>
          )}
          {suggestion && (
            <p className="text-[11px] opacity-75">
              {suggestion.rationale} · {bucketLabel(suggestion.bucket)} ·{" "}
              confidence {Math.round(suggestion.confidence * 100)}%
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
