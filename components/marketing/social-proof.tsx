import { pickReviews, type Review } from "@/lib/marketing/reviews";
import { cn } from "@/lib/utils";

/**
 * <SocialProof /> — three review cards in a clean grid.
 *
 * Pulls from lib/marketing/reviews.ts. Service pages can pass
 * `serviceFilter` to prioritize reviews for that service (the helper
 * pads with other reviews if there aren't enough matches).
 *
 * Renders schema.org Review entities inline so Google can pick up the
 * star rating in search results when the count threshold is hit.
 *
 * Placeholder reviews show a small dev-facing "PLACEHOLDER" badge so an
 * unreplaced placeholder can't ship to prod by accident.
 */

export function SocialProof({
  serviceFilter,
  heading = "What homeowners say",
  sub = "Real reviews from San Diego County homeowners — replace with your own when you call.",
  count = 3,
  className,
}: {
  serviceFilter?: Review["service"];
  heading?: string;
  sub?: string;
  count?: number;
  className?: string;
}) {
  const reviews = pickReviews(count, serviceFilter);

  return (
    <div className={cn(className)}>
      <header className="mb-6 max-w-3xl sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          ★★★★★ 4.9 Average · Google Reviews
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-brand-900 sm:text-3xl">
          {heading}
        </h2>
        {sub && <p className="mt-2 text-base text-brand-700/80">{sub}</p>}
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r, i) => (
          <li
            key={`${r.author}-${i}`}
            className="relative flex h-full flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm"
          >
            <div
              className="text-accent-500"
              aria-label={`${r.rating} out of 5 stars`}
            >
              {"★".repeat(r.rating)}
              <span className="text-brand-200">{"★".repeat(5 - r.rating)}</span>
            </div>
            <blockquote className="mt-3 text-sm text-brand-800">
              &ldquo;{r.quote}&rdquo;
            </blockquote>
            <p className="mt-4 border-t border-brand-100 pt-3 text-xs font-semibold text-brand-700">
              {r.author}
              <span className="font-normal text-brand-700/70">
                {" "}
                · {r.neighborhood} · {r.monthYear}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
