/**
 * Customer reviews shown in the <SocialProof /> component.
 *
 * EVERY entry below is a placeholder. Ronnie should:
 *   1. Pull real Google reviews for Rose Concrete and Development.
 *   2. Replace each entry's `quote`, `author`, `neighborhood`, and
 *      `monthYear` with the real data.
 *   3. Delete the `placeholder: true` flag once replaced (the
 *      <SocialProof /> component renders a small dev-only badge on
 *      placeholders so unreplaced ones can't ship to prod by accident).
 *
 * Spread across services + neighborhoods so a homeowner browsing any
 * page sees a review that's relevant to their service.
 */

export type Review = {
  /** 1–5 star rating. */
  rating: 1 | 2 | 3 | 4 | 5;
  /** Quote — keep under 40 words for fast scan. */
  quote: string;
  /** First name + last initial. Real reviews require this format. */
  author: string;
  /** Neighborhood or city in San Diego County. */
  neighborhood: string;
  /** "Mar 2026" — give the review temporal credibility. */
  monthYear: string;
  /** Tags this review to a service so service pages can filter. */
  service:
    | "driveway"
    | "patio"
    | "sidewalk"
    | "decorative"
    | "pool_deck"
    | "rv_pad"
    | "retaining_wall"
    | "other";
  /** PLACEHOLDER flag — replace each entry; component shows a dev badge. */
  placeholder?: boolean;
};

export const REVIEWS: readonly Review[] = [
  // PLACEHOLDER — REPLACE WITH REAL GOOGLE REVIEW
  {
    rating: 5,
    quote:
      "Ronnie poured our 600-square-foot driveway in two days and didn't leave a speck of mud on the grass. Quoted exactly what he charged. Crew that showed up was the same crew Ronnie said would show up.",
    author: "Sarah M.",
    neighborhood: "Clairemont",
    monthYear: "Mar 2026",
    service: "driveway",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL GOOGLE REVIEW
  {
    rating: 5,
    quote:
      "We hired three contractors before Rose. Only one who actually walked the yard, talked through drainage, and showed up the day he said he would. Patio looks like the listing photos.",
    author: "Mike R.",
    neighborhood: "Bonita",
    monthYear: "Feb 2026",
    service: "patio",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL GOOGLE REVIEW
  {
    rating: 5,
    quote:
      "Got a Safe Sidewalks Program notice in January, panicked. Ronnie walked us through the whole program, handled the paperwork, and our city contribution was honored. Done in 5 weeks.",
    author: "Jennifer L.",
    neighborhood: "North Park",
    monthYear: "Mar 2026",
    service: "sidewalk",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL GOOGLE REVIEW
  {
    rating: 5,
    quote:
      "Stamped patio in our backyard. Picked the slate pattern from his sample boards. The finish is clean, no fading lines, and it looks like a $40,000 patio at half the price.",
    author: "David K.",
    neighborhood: "La Mesa",
    monthYear: "Jan 2026",
    service: "decorative",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL GOOGLE REVIEW
  {
    rating: 5,
    quote:
      "Pool deck redo with exposed aggregate. Ronnie thought through the slope so water flows away from the coping, not into it. Ten months in, no cracking, dogs love it.",
    author: "Rachel T.",
    neighborhood: "Point Loma",
    monthYear: "Dec 2025",
    service: "pool_deck",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL GOOGLE REVIEW
  {
    rating: 5,
    quote:
      "Reinforced RV pad next to the driveway. Six inches, doubled rebar, exactly what he said it would be. The Class A sits on it without a flicker of cracking. Worth every dollar.",
    author: "Tom B.",
    neighborhood: "El Cajon",
    monthYear: "Nov 2025",
    service: "rv_pad",
    placeholder: true,
  },
];

/**
 * Pick up to N reviews, optionally filtered by service. Falls back to
 * other reviews if there aren't enough matches for the requested count.
 */
export function pickReviews(
  count: number,
  serviceFilter?: Review["service"],
): readonly Review[] {
  if (!serviceFilter) return REVIEWS.slice(0, count);
  const matches = REVIEWS.filter((r) => r.service === serviceFilter);
  if (matches.length >= count) return matches.slice(0, count);
  // Pad with non-matching reviews so we always have `count` to show.
  const others = REVIEWS.filter((r) => r.service !== serviceFilter);
  return [...matches, ...others].slice(0, count);
}
