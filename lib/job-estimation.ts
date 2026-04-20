/**
 * Job estimation intelligence — rolls up completed projects into
 * "what should a 500 sqft stamped driveway cost / take?" answers.
 *
 * Backed by two SQL views created in migration 041:
 *   - job_phase_durations  — per (service_type, phase, sqft bucket)
 *   - job_total_estimates  — per (service_type, sqft bucket)
 *
 * Confidence score is the sample size clamped to [0, 1] — 0 jobs =
 * no confidence, 10+ jobs = full confidence. Linear between. We
 * surface this on the UI so Ronnie knows whether the suggestion is
 * backed by real data or extrapolated.
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

export type SqftBucket = "xs" | "sm" | "md" | "lg";

export type PhaseDuration = {
  service_type: string;
  phase_kind: string;
  sqft_bucket: SqftBucket;
  sample_size: number;
  avg_hours: number | null;
  avg_days: number | null;
  avg_sqft: number | null;
  avg_revenue: number | null;
};

export type TotalEstimate = {
  service_type: string;
  sqft_bucket: SqftBucket;
  sample_size: number;
  avg_sqft: number | null;
  avg_revenue: number | null;
  min_revenue: number | null;
  max_revenue: number | null;
  median_revenue: number | null;
  avg_price_per_sqft: number | null;
  avg_total_days: number | null;
};

export type EstimateSuggestion = {
  serviceType: string;
  sqft: number;
  bucket: SqftBucket;
  sampleSize: number;
  suggestedPrice: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  pricePerSqft: number | null;
  daysEstimate: number | null;
  /** 0 = no data, 1 = fully confident. Linear to 10 samples. */
  confidence: number;
  /** A short human-readable explanation of what the suggestion is
   *  based on, shown under the suggestion on the quote editor. */
  rationale: string;
};

/** Bucketize sqft — must match the SQL case statement in migration 041. */
export function bucketForSqft(sqft: number | null | undefined): SqftBucket {
  const n = Number(sqft ?? 0);
  if (n < 500) return "xs";
  if (n < 1000) return "sm";
  if (n < 2000) return "md";
  return "lg";
}

export function bucketLabel(b: SqftBucket): string {
  switch (b) {
    case "xs":
      return "under 500 sqft";
    case "sm":
      return "500 – 999 sqft";
    case "md":
      return "1,000 – 1,999 sqft";
    case "lg":
      return "2,000+ sqft";
  }
}

/** Load every per-phase rollup for the current tenant. */
export async function loadPhaseDurations(): Promise<PhaseDuration[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("job_phase_durations")
    .select(
      "service_type, phase_kind, sqft_bucket, sample_size, avg_hours, avg_days, avg_sqft, avg_revenue",
    );
  return (data ?? []) as PhaseDuration[];
}

export async function loadTotalEstimates(): Promise<TotalEstimate[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("job_total_estimates")
    .select(
      "service_type, sqft_bucket, sample_size, avg_sqft, avg_revenue, min_revenue, max_revenue, median_revenue, avg_price_per_sqft, avg_total_days",
    );
  return (data ?? []) as TotalEstimate[];
}

/**
 * Suggest a price for a new quote given its service_type + sqft.
 * Falls through three fallbacks:
 *   1. Same service type + same sqft bucket (highest confidence).
 *   2. Same service type, any bucket — multiplied by avg price/sqft
 *      × requested sqft (medium confidence).
 *   3. null — no data, UI should not show a suggestion.
 */
export async function suggestPriceForQuote(opts: {
  serviceType: string | null;
  sqft: number | null;
}): Promise<EstimateSuggestion | null> {
  if (!opts.serviceType || !opts.sqft || opts.sqft <= 0) return null;
  const bucket = bucketForSqft(opts.sqft);
  const totals = await loadTotalEstimates();

  // Tier 1: exact service + bucket match.
  const exact = totals.find(
    (t) => t.service_type === opts.serviceType && t.sqft_bucket === bucket,
  );
  if (exact && exact.sample_size > 0) {
    const avg = exact.avg_revenue ?? 0;
    const perSqft = exact.avg_price_per_sqft ?? (avg / (exact.avg_sqft ?? 1));
    // Project a price from the caller's sqft using per-sqft rate,
    // averaged with the bucket's mean. Bias toward bucket mean when
    // sample is large, per-sqft when sample is small + sqft is far
    // from bucket average.
    const perSqftPrice = perSqft * opts.sqft;
    const blended = (avg + perSqftPrice) / 2;
    return {
      serviceType: opts.serviceType,
      sqft: opts.sqft,
      bucket,
      sampleSize: exact.sample_size,
      suggestedPrice: Math.round(blended),
      priceLow: exact.min_revenue ? Math.round(exact.min_revenue) : null,
      priceHigh: exact.max_revenue ? Math.round(exact.max_revenue) : null,
      pricePerSqft: perSqft ? Math.round(perSqft * 100) / 100 : null,
      daysEstimate: exact.avg_total_days ? Math.round(exact.avg_total_days) : null,
      confidence: Math.min(exact.sample_size / 10, 1),
      rationale: `Based on ${exact.sample_size} completed ${opts.serviceType} job${exact.sample_size === 1 ? "" : "s"} in ${bucketLabel(bucket)}.`,
    };
  }

  // Tier 2: same service type, fallback to cross-bucket per-sqft rate.
  const anyBucket = totals
    .filter((t) => t.service_type === opts.serviceType)
    .sort((a, b) => b.sample_size - a.sample_size)[0];
  if (anyBucket && anyBucket.sample_size > 0) {
    const perSqft =
      anyBucket.avg_price_per_sqft ??
      (anyBucket.avg_revenue ?? 0) / (anyBucket.avg_sqft ?? 1);
    const suggested = Math.round(perSqft * opts.sqft);
    return {
      serviceType: opts.serviceType,
      sqft: opts.sqft,
      bucket,
      sampleSize: anyBucket.sample_size,
      suggestedPrice: suggested,
      priceLow: null,
      priceHigh: null,
      pricePerSqft: perSqft ? Math.round(perSqft * 100) / 100 : null,
      daysEstimate: anyBucket.avg_total_days
        ? Math.round(anyBucket.avg_total_days)
        : null,
      // Cross-bucket extrapolation → lower confidence.
      confidence: Math.min(anyBucket.sample_size / 20, 0.6),
      rationale: `Extrapolated from ${anyBucket.sample_size} ${opts.serviceType} jobs in other size ranges (no direct match for ${bucketLabel(bucket)} yet).`,
    };
  }

  return null;
}

/**
 * Flag a quote price as unusually high or low vs history. Returns
 * null when there's no data; otherwise a { tone, message } pair the
 * UI can render as a chip on the quote editor.
 */
export async function evaluateQuotePrice(opts: {
  serviceType: string | null;
  sqft: number | null;
  proposedPrice: number;
}): Promise<
  | null
  | {
      tone: "ok" | "warning" | "alert";
      message: string;
      suggestion?: EstimateSuggestion;
    }
> {
  const suggestion = await suggestPriceForQuote({
    serviceType: opts.serviceType,
    sqft: opts.sqft,
  });
  if (!suggestion || !suggestion.suggestedPrice) return null;
  const avg = suggestion.suggestedPrice;
  const ratio = opts.proposedPrice / avg;
  if (ratio < 0.7) {
    return {
      tone: "alert",
      message: `This quote is ~${Math.round((1 - ratio) * 100)}% below the average for similar jobs ($${avg.toLocaleString()}). Double-check the scope.`,
      suggestion,
    };
  }
  if (ratio > 1.4) {
    return {
      tone: "warning",
      message: `This quote is ~${Math.round((ratio - 1) * 100)}% above the average for similar jobs ($${avg.toLocaleString()}).`,
      suggestion,
    };
  }
  return { tone: "ok", message: `In line with similar jobs ($${avg.toLocaleString()} avg).`, suggestion };
}
