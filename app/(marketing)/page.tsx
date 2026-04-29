import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/marketing/lead-form";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { ServiceAreaList } from "@/components/marketing/service-area-list";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { RecentProjects } from "@/components/marketing/recent-projects";
import { Section } from "@/components/marketing/section";
import { CORE_SERVICES } from "@/lib/marketing/services";
import { localBusinessJsonLd, SITE_ORIGIN } from "@/lib/marketing/schema";

/**
 * Home page — the apex (sandiegoconcrete.ai) entry point.
 *
 * Section order tuned for conversion + SEO:
 *   1. Hero            — headline, sub, two CTAs (call / scroll-to-form)
 *   2. Trust badges    — license, veteran, insured, in-house crew
 *   3. Services grid   — 7 cards linking to /services/<slug>
 *   4. Programs        — Safe Sidewalks Program + 2 high-conversion landing pages
 *   5. Service areas   — 12 cities, each linking to /service-areas/<slug>
 *   6. Lead form       — "Get a Free Quote" + <LeadForm>, anchor #quote
 *   7. Why Rose        — 4 differentiators, short and benefit-led
 *   8. Final CTA band  — phone number, dual CTA
 *
 * SEO:
 *   - Per-page metadata (title, description, OG, Twitter, canonical)
 *   - LocalBusiness JSON-LD inlined as <script type="application/ld+json">
 *   - All internal links use real <a>/<Link> for crawlability
 *   - One <h1>, h2 per section, h3 per card
 */

const TITLE =
  "San Diego Concrete Contractor — Driveways, Patios & Sidewalks | Rose Concrete";
const DESCRIPTION =
  "Family-run, veteran-owned San Diego concrete contractor. Driveways, patios, sidewalks, and the Safe Sidewalks Program. CA License #1130763, fully insured, in-house crew. Free quotes — call (619) 537-9408.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/`,
    siteName: "Rose Concrete",
    images: [
      {
        url: `${SITE_ORIGIN}/og-default.png`,
        width: 1200,
        height: 630,
        alt: "Rose Concrete — San Diego Concrete Contractor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_ORIGIN}/og-default.png`],
  },
};

// ─── Featured landing pages (programs callout) ───────────────────────────
// Lives inline because the home page is currently the only surface that
// references it. If a second surface (e.g. a /landing index) needs the
// same set, lift this into lib/marketing/featured-programs.ts.
const FEATURED_PROGRAMS = [
  {
    eyebrow: "Flagship program",
    name: "Safe Sidewalks Program",
    href: "/landing/safe-sidewalks-program-san-diego",
    description:
      "City of San Diego pays a portion. Ronnie handles demo, forms, pour, and inspection — start to finish.",
    cta: "See if you qualify",
  },
  {
    eyebrow: "Most-requested job",
    name: "Driveway Replacement",
    href: "/landing/driveway-replacement-san-diego",
    description:
      "Tear out the cracked slab. Pour a new one in 2–3 days. Park on it inside a week.",
    cta: "Get a driveway quote",
  },
  {
    eyebrow: "Backyard upgrade",
    name: "Pool Decks",
    href: "/landing/pool-decks-san-diego",
    description:
      "Slip-resistant, heat-friendly finishes around your pool. Pet-paw-safe and built to handle wet feet for years.",
    cta: "Plan your pool deck",
  },
] as const;

// ─── "Why Rose Concrete" reasons ────────────────────────────────────────
const WHY_REASONS = [
  {
    title: "Same crew every job",
    body: "Ronnie pours every job himself with the same in-house crew. The person you hire is the person who shows up.",
  },
  {
    title: "Veteran-owned",
    body: "Disciplined, on time, accountable. We treat your project the way the Navy taught us to run an op.",
  },
  {
    title: "Local to San Diego",
    body: "We know the city codes, the soils, and the inspectors. Permits don't slow your job down.",
  },
  {
    title: "Fast quotes, faster pours",
    body: "Most quotes done same-week. Most jobs scheduled within two weeks of acceptance.",
  },
] as const;

// ─── Page ───────────────────────────────────────────────────────────────

export default function MarketingHome() {
  const schema = localBusinessJsonLd();

  return (
    <>
      {/* JSON-LD for Google. Runs at request time, no client JS. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Hero />
      <TrustBadgesBlock />
      <ServicesGrid />
      <Section tone="white">
        <SocialProof />
      </Section>
      <ProgramsCallout />
      {/* id="recent" — footer "Recent Work" link scrolls here. */}
      <Section id="recent" tone="cream">
        <RecentProjects />
      </Section>
      <ServiceAreaList />
      <LeadFormBlock />
      <WhyRoseConcrete />
      <FinalCallCta />
    </>
  );
}

// ─── 1. Hero ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <PageHero
      backgroundImage="/images/hero-patio-hillside.jpg"
      eyebrow="San Diego County · Veteran-Owned · CA License #1130763"
      title={
        <>
          Free Driveway Quote in 60 Seconds —{" "}
          <span className="text-accent-600">
            San Diego&apos;s Veteran-Owned Concrete Pros.
          </span>
        </>
      }
      sub={
        <>
          Driveways, patios, sidewalks, and decorative flatwork. Ronnie pours
          every job himself with the same in-house crew — quotes back same-week.
        </>
      }
      formProps={{
        title: "Get Your Free Quote in 60 Seconds",
        eyebrow: "Free · No obligation · 60 seconds",
      }}
    />
  );
}

// ─── 2. Trust badges ────────────────────────────────────────────────────

function TrustBadgesBlock() {
  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <TrustBadges />
      </div>
    </section>
  );
}

// ─── 3. Services grid ───────────────────────────────────────────────────

function ServicesGrid() {
  return (
    <section className="bg-cream-50 py-12 sm:py-16" aria-labelledby="services-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-8 max-w-3xl sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Services
          </p>
          <h2
            id="services-heading"
            className="mt-1 text-3xl font-extrabold text-brand-900 sm:text-4xl"
          >
            Concrete work for San Diego homeowners
          </h2>
          <p className="mt-2 text-base text-brand-700/80">
            Most homeowners hire us for one of these seven jobs. Tap any to see
            scope, timeline, and what&apos;s included.
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_SERVICES.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/services/${s.slug}`}
                className="group flex h-full flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm transition hover:border-accent-400 hover:shadow-md"
              >
                <h3 className="text-xl font-extrabold text-brand-900 group-hover:text-accent-700">
                  {s.name}
                </h3>
                <p className="mt-2 text-sm text-brand-700/90">
                  {s.shortDescription}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 group-hover:text-accent-700">
                  See {s.name.toLowerCase()}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── 4. Programs callout ────────────────────────────────────────────────

function ProgramsCallout() {
  return (
    <section
      className="bg-brand-50 py-12 sm:py-16"
      aria-labelledby="programs-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-8 max-w-3xl sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Popular programs
          </p>
          <h2
            id="programs-heading"
            className="mt-1 text-3xl font-extrabold text-brand-900 sm:text-4xl"
          >
            Three jobs we book the most
          </h2>
        </header>

        <ul className="grid gap-5 md:grid-cols-3">
          {FEATURED_PROGRAMS.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="group flex h-full flex-col rounded-xl border border-brand-100 bg-white p-6 shadow-sm transition hover:border-accent-400 hover:shadow-md"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
                  {p.eyebrow}
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-brand-900 group-hover:text-accent-700">
                  {p.name}
                </h3>
                <p className="mt-3 text-sm text-brand-700/90">
                  {p.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 group-hover:text-accent-700">
                  {p.cta}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── 6. Lead form ───────────────────────────────────────────────────────

function LeadFormBlock() {
  return (
    <section
      id="quote"
      // scroll-mt clears the sticky header on `#quote` anchor jumps.
      className="scroll-mt-20 bg-white py-14 sm:py-20 sm:scroll-mt-24"
      aria-labelledby="quote-heading"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Free · No obligation
          </p>
          <h2
            id="quote-heading"
            className="mt-1 text-3xl font-extrabold text-brand-900 sm:text-4xl"
          >
            Get a Free Quote
          </h2>
          <p className="mt-2 text-base text-brand-700/80">
            Tell us about the job. We&apos;ll text you a confirmation and Ronnie
            will call you within the hour.
          </p>
        </header>
        <LeadForm compact />
      </div>
    </section>
  );
}

// ─── 7. Why Rose Concrete ───────────────────────────────────────────────

function WhyRoseConcrete() {
  return (
    <section
      className="bg-cream-50 py-14 sm:py-20"
      aria-labelledby="why-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Why Rose Concrete
          </p>
          <h2
            id="why-heading"
            className="mt-1 text-3xl font-extrabold text-brand-900 sm:text-4xl"
          >
            Why homeowners pick us over the big crews
          </h2>
        </header>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_REASONS.map((r) => (
            <li
              key={r.title}
              className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-extrabold text-brand-900">
                {r.title}
              </h3>
              <p className="mt-2 text-sm text-brand-700/90">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
