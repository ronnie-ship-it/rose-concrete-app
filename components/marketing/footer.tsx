import Link from "next/link";
import {
  BUSINESS_NAME,
  EMAIL,
  EMAIL_HREF,
  GOOGLE_REVIEW_URL,
  LICENSE,
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
  SERVICE_AREAS,
  TRUST_SIGNALS,
} from "@/lib/marketing/brand";
import { CORE_SERVICES } from "@/lib/marketing/services";

/**
 * Marketing footer — SEO-rich, link-dense.
 *
 * Five columns at lg+ (stacks below):
 *
 *   1. Brand + 5 trust badges
 *   2. Services       — every /services/<slug>
 *   3. Service Areas  — every /service-areas/<slug>
 *   4. Company        — About, Contact, Reviews ↗, Recent work
 *   5. Legal          — Privacy, Terms
 *
 * Bottom strip: phone, email, license, copyright.
 *
 * "Service Areas" lives ONLY in the footer (removed from top nav per
 * the marketing-copy batch on 2026-04-28). Underlying /service-areas
 * pages stay live for SEO + direct URL access.
 *
 * City list: only the 13 cities currently with /service-areas/<slug>
 * pages in lib/marketing/service-areas.ts. Don't add 404 links —
 * additional cities (Hillcrest, Poway, etc.) get their own pages
 * in a follow-up before being linked from the footer.
 *
 * Server-rendered, no client JS.
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const COMPANY_LINKS = [
  { label: "About", href: "/about-us", external: false },
  { label: "Contact", href: "/contact", external: false },
  { label: "Recent Work", href: "/#recent", external: false },
  { label: "Leave a Google Review", href: GOOGLE_REVIEW_URL, external: true },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
] as const;

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-brand-100 bg-brand-900 text-cream-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1 — Brand + trust badges */}
          <div className="lg:col-span-1">
            <p className="text-xl font-extrabold text-white">{BUSINESS_NAME}</p>
            <p className="mt-2 text-sm text-cream-50/80">
              Family-run, veteran-owned San Diego concrete contractor.
            </p>
            <ul className="mt-5 space-y-1.5 text-sm text-cream-50/90">
              {TRUST_SIGNALS.map((sig) => (
                <li key={sig} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"
                  />
                  <span>{sig}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2 — Services */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Services
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {CORE_SERVICES.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="text-cream-50/90 transition hover:text-accent-300"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3 — Service Areas */}
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

          {/* 4 — Company */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Company
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {COMPANY_LINKS.map((l) =>
                l.external ? (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-cream-50/90 transition hover:text-accent-300"
                    >
                      {l.label}
                      <span aria-hidden="true" className="text-xs opacity-70">
                        ↗
                      </span>
                    </a>
                  </li>
                ) : (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-cream-50/90 transition hover:text-accent-300"
                    >
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* 5 — Legal */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Legal
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-cream-50/90 transition hover:text-accent-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact strip */}
        <div className="mt-12 grid gap-6 border-t border-cream-50/15 pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Phone
            </p>
            <a
              href={PHONE_TEL_HREF}
              className="mt-1 block text-lg font-bold text-white transition hover:text-accent-300"
            >
              {PHONE_DISPLAY}
            </a>
            <p className="mt-1 text-xs text-cream-50/70">7 days · 7am–7pm</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Email
            </p>
            <a
              href={EMAIL_HREF}
              className="mt-1 block break-all text-sm font-bold text-cream-50/90 transition hover:text-accent-300"
            >
              {EMAIL}
            </a>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              License
            </p>
            <p className="mt-1 text-sm font-bold text-cream-50/90">
              {LICENSE}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">
              Service area
            </p>
            <p className="mt-1 text-sm font-bold text-cream-50/90">
              Greater San Diego County
            </p>
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
