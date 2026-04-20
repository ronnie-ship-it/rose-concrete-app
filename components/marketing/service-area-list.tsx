import Link from "next/link";
import { SERVICE_AREAS } from "@/lib/marketing/brand";
import { cn } from "@/lib/utils";

/** Slugify a city name to its /service-areas/<slug> route. */
export function serviceAreaSlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Grid of city links to /service-areas/<slug>. Two presentations:
 *   - "section" (default): full section with heading + grid, used on the
 *     home page and landing pages.
 *   - "inline":            bare grid, no heading, used inside service
 *     pages where the surrounding section has its own H2.
 *
 * Crawlable text-only links — no JS, no dropdowns. Local SEO needs the
 * city name to appear inside an `<a>` element on every service surface.
 */

type Variant = "section" | "inline";

export function ServiceAreaList({
  variant = "section",
  heading = "We pour across San Diego County",
  subhead = "Same-week quotes from the South Bay to the North County.",
  className,
}: {
  variant?: Variant;
  heading?: string;
  subhead?: string;
  className?: string;
}) {
  const grid = (
    <ul
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4",
        variant === "inline" && className,
      )}
    >
      {SERVICE_AREAS.map((city) => (
        <li key={city}>
          <Link
            href={`/service-areas/${serviceAreaSlug(city)}`}
            className="block rounded-md border border-brand-100 bg-white px-3 py-2.5 text-sm font-medium text-brand-800 transition hover:border-accent-400 hover:bg-accent-50 hover:text-brand-900"
          >
            {city}
          </Link>
        </li>
      ))}
    </ul>
  );

  if (variant === "inline") return grid;

  return (
    <section className={cn("py-12 sm:py-16", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
            {heading}
          </h2>
          {subhead && (
            <p className="mt-2 text-base text-brand-700/80">{subhead}</p>
          )}
        </div>
        {grid}
      </div>
    </section>
  );
}
