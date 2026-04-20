import Link from "next/link";
import {
  BUSINESS_NAME,
  EMAIL,
  EMAIL_HREF,
  GOOGLE_REVIEW_URL,
  LICENSE,
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
  PRIMARY_NAV,
  SERVICE_AREAS,
  TRUST_SIGNALS,
} from "@/lib/marketing/brand";

/**
 * Marketing footer.
 *
 * Three jobs:
 *   1. Trust signals — license, veteran-owned, insured, in-house crew —
 *      the four claims that turn a "thinking about it" homeowner into
 *      a "let me call right now" lead.
 *   2. Service-area links — local SEO. Each city shows up as an internal
 *      link to /service-areas/<slug>, which is the canonical landing
 *      page for that city. Crawlable text, no JS, no dropdowns.
 *   3. Phone + email — last-chance escape hatch for visitors who skipped
 *      the form. Both are real `tel:` / `mailto:` so mobile clicks dial.
 *
 * Server-rendered, no client JS.
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-brand-100 bg-brand-900 text-cream-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand + trust */}
          <div className="lg:col-span-1">
            <p className="text-xl font-extrabold text-white">{BUSINESS_NAME}</p>
            <p className="mt-2 text-sm text-cream-50/80">
              Family-run, veteran-owned San Diego concrete contractor.
            </p>
            <ul className="mt-5 space-y-1.5 text-sm text-cream-50/90">
              {TRUST_SIGNALS.map((sig) => (
                <li key={sig} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                  <span>{sig}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Site nav */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Sitemap
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-cream-50/90 transition hover:text-accent-300"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Service areas — local SEO link block */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Service Areas
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {SERVICE_AREAS.map((city) => (
                <li key={city}>
                  <Link
                    href={`/service-areas/${slugify(city)}`}
                    className="text-cream-50/90 transition hover:text-accent-300"
                  >
                    {city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Contact
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={PHONE_TEL_HREF}
                  className="block text-lg font-bold text-white transition hover:text-accent-300"
                >
                  {PHONE_DISPLAY}
                </a>
                <p className="text-xs text-cream-50/70">7 days · 7am–7pm</p>
              </li>
              <li>
                <a
                  href={EMAIL_HREF}
                  className="break-all text-cream-50/90 transition hover:text-accent-300"
                >
                  {EMAIL}
                </a>
              </li>
              <li className="text-cream-50/70">San Diego County, CA</li>
              <li className="pt-2">
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-300 transition hover:text-accent-200"
                >
                  <span aria-hidden="true">★</span>
                  Leave us a Google review
                  <span aria-hidden="true" className="text-xs opacity-70">
                    ↗
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-cream-50/15 pt-6 text-xs text-cream-50/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {BUSINESS_NAME}. {LICENSE}.
          </p>
          <p>
            Concrete contractor serving residential homeowners across San Diego County.
          </p>
        </div>
      </div>
    </footer>
  );
}
