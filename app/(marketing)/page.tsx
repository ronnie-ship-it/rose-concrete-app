import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonClassNames } from "@/components/ui/button";
import { LeadForm } from "@/components/marketing/lead-form";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { SocialProof } from "@/components/marketing/social-proof";
import { Section } from "@/components/marketing/section";
import {
  GOOGLE_REVIEW_URL,
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";
import { localBusinessJsonLd, SITE_ORIGIN } from "@/lib/marketing/schema";

/**
 * Home page — sandiegoconcrete.ai
 *
 * Section order:
 *   1. Hero             — headline + single CTA (form lives lower)
 *   2. Trust strip      — reviews · license · veteran-owned
 *   3. Services grid    — 5 spec tiles + "also: …" line
 *   4. Recent Projects  — 9-photo 3-column grid (id="recent")
 *   5. Why us           — 3 cards (veteran-owned, in-house, clean sites)
 *   6. Owner's note     — Thomas Rose blurb + crew photo
 *   7. Reviews          — pull-quotes ("What customers actually say")
 *   8. Lead form        — anchor #quote, target for hero + final CTAs
 *   9. Final CTA band   — phone + "Get a Free On-Site Estimate"
 *
 * Photo grid renders nine curated jpgs from /public/images/ — selection
 * documented in RECENT_PROJECTS below. To swap photos, replace the
 * filename + alt; the grid layout is fixed at 3 cols on lg+.
 */

const TITLE =
  "San Diego Concrete Contractor — Driveways, Patios & Sidewalks | Rose Concrete";
const DESCRIPTION =
  "Family-run, veteran-owned San Diego concrete contractor. Driveways, patios, sidewalks, slabs, and decorative finishes. CA License #1130763, fully insured, in-house crew. Free quotes — call (619) 537-9408.";

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

// ─── Service tiles ──────────────────────────────────────────────────────
// Five tiles per spec. "Slabs & Foundations" doesn't have a dedicated
// service page yet — points at /services/paving (closest existing
// match) until a /services/slabs-foundations page ships.
const SERVICE_TILES = [
  {
    name: "Driveways",
    href: "/services/driveways",
    description:
      "New pours and replacements that hold up to San Diego soil and sun.",
  },
  {
    name: "Patios",
    href: "/services/patios",
    description:
      "From simple slabs to stamped, decorative finishes you'll actually use.",
  },
  {
    name: "Walkways & Sidewalks",
    href: "/services/walkways-sidewalks",
    description:
      "New, replaced, or repaired — including the City Safe Sidewalks Program.",
  },
  {
    name: "Slabs & Foundations",
    href: "/services/paving",
    description:
      "Garage pads, ADUs, sheds, footings. Engineered when it matters.",
  },
  {
    name: "Decorative",
    href: "/services/decorative-concrete",
    description:
      "Stamped, exposed aggregate, and finishes that don't look like everyone else's.",
  },
] as const;

// ─── "Why Rose Concrete" reasons ────────────────────────────────────────
const WHY_REASONS = [
  {
    title: "Veteran-owned, family-run.",
    body: "We built this business the same way we approach everything: show up, do what we said, treat people right.",
  },
  {
    title: "In-house crew.",
    body: "No subcontracted strangers. The same guys you meet on day one finish the job.",
  },
  {
    title: "Clean job sites.",
    body: "Plastic down, equipment off your driveway, neighbors not pissed at you afterward.",
  },
] as const;

// ─── Page ───────────────────────────────────────────────────────────────

export default function MarketingHome() {
  const schema = localBusinessJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Hero />
      <TrustStrip />
      <ServicesGrid />
      <RecentProjects />
      <WhyRose />
      <OwnersNote />
      <Section tone="white">
        <SocialProof
          heading="What customers actually say"
          sub=""
        />
        <p className="mt-6 text-center">
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-semibold text-accent-700 hover:text-accent-600"
          >
            Read all 140+ reviews →
          </a>
        </p>
      </Section>
      <LeadFormBlock />
      <FinalCallCta
        heading="Ready to get started?"
        sub="Free on-site estimates. We'll come measure, talk through options, and email you a written quote within 48 hours."
      />
    </>
  );
}

// ─── 1. Hero ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-brand-100 bg-cream-50">
      <Image
        src="/images/hero-patio-hillside.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 object-cover object-center"
      />
      {/* Cream wash — same opacity stack the previous hero used. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,239,224,0.75) 0%, rgba(253,251,245,0.72) 60%, rgba(255,255,255,0.68) 100%)",
        }}
      />
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
          San Diego concrete done right.
          <br className="hidden sm:block" />{" "}
          <span className="text-accent-600">Licensed, local, on time.</span>
        </h1>

        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href="#quote"
            className={buttonClassNames({
              variant: "primary",
              size: "xl",
              className: "w-full sm:w-auto",
            })}
          >
            Get a Free On-Site Estimate
          </a>
          <p className="text-sm text-brand-700">
            Or call{" "}
            <a
              href={PHONE_TEL_HREF}
              className="font-semibold text-accent-700 hover:text-accent-600"
            >
              {PHONE_DISPLAY}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── 2. Trust strip ─────────────────────────────────────────────────────

function TrustStrip() {
  return (
    <section className="border-b border-brand-100 bg-cream-50/80 py-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm font-semibold text-brand-800 sm:gap-x-5 sm:text-base">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-accent-600">
              ★★★★★
            </span>
            <span>140+ Google Reviews</span>
          </span>
          <span aria-hidden="true" className="text-brand-300">
            ·
          </span>
          <span>Licensed CSLB #1130763</span>
          <span aria-hidden="true" className="text-brand-300">
            ·
          </span>
          <span>Veteran-Owned</span>
        </p>
      </div>
    </section>
  );
}

// ─── 3. Services grid ───────────────────────────────────────────────────

function ServicesGrid() {
  return (
    <section
      className="bg-white py-12 sm:py-16"
      aria-labelledby="services-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-8 max-w-3xl sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Services
          </p>
          <h2
            id="services-heading"
            className="mt-1 text-3xl font-extrabold text-brand-900 sm:text-4xl"
          >
            What we build
          </h2>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_TILES.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex h-full flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm transition hover:border-accent-400 hover:shadow-md"
              >
                <h3 className="text-xl font-extrabold text-brand-900 group-hover:text-accent-700">
                  {s.name}
                </h3>
                <p className="mt-2 text-sm text-brand-700/90">
                  {s.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 group-hover:text-accent-700">
                  See {s.name.toLowerCase()}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm italic text-brand-700/80">
          Also: bollards, retaining walls, RV pads, pickleball courts, and
          more — ask us.
        </p>
      </div>
    </section>
  );
}

// ─── 4. Why us ──────────────────────────────────────────────────────────

function WhyRose() {
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
            Why folks pick Rose
          </h2>
        </header>

        <ul className="grid gap-6 sm:grid-cols-3">
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

// ─── 6. Owner's note ────────────────────────────────────────────────────

function OwnersNote() {
  return (
    <section className="bg-white py-14 sm:py-20" aria-labelledby="owner-heading">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 md:grid-cols-[2fr,3fr] md:items-center md:gap-12">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-brand-100 shadow-sm">
          <Image
            src="/images/rose-shirt-crew.jpg"
            alt="Thomas Rose with the Rose Concrete crew on a San Diego job site"
            fill
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2
            id="owner-heading"
            className="text-2xl font-extrabold text-brand-900 sm:text-3xl"
          >
            A note from the owner
          </h2>
          <blockquote className="mt-5 text-lg text-brand-700 sm:text-xl">
            &ldquo;I started Rose Concrete because I love building.
            We&rsquo;re a veteran-owned, family-run business — show up on
            time, do quality work, treat people right. We&rsquo;re a small
            local team and we want to stay that way.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm font-semibold text-brand-800">
            — Thomas Rose, Owner
          </p>
          <p className="mt-6">
            <Link
              href="/about-us"
              className="text-sm font-semibold text-accent-700 hover:text-accent-600"
            >
              Read more about us →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── 4. Recent Projects ─────────────────────────────────────────────────
// Curated 9-photo grid. Files live in /public/images/. Replace any
// item by swapping the file + alt; layout stays a fixed 3-col grid
// on lg+ (1-col on mobile, 2-col on sm).

const RECENT_PROJECT_PHOTOS = [
  {
    src: "/images/01-driveway-pink-house-hero.jpg",
    alt: "Finished concrete driveway at a pink stucco home in San Diego",
  },
  {
    src: "/images/04-driveway-tan-palms-pour-day.jpg",
    alt: "Crew pouring a fresh concrete driveway lined with palm trees on pour day",
  },
  {
    src: "/images/12-walkway-spanish-wraparound.jpg",
    alt: "Wraparound concrete walkway at a Spanish-style San Diego home",
  },
  {
    src: "/images/15-patio-stamped-ashlar-hero.jpg",
    alt: "Stamped concrete patio with an ashlar slate pattern",
  },
  {
    src: "/images/19-patio-hillside-canyon-view.jpg",
    alt: "Hillside concrete patio overlooking a San Diego canyon",
  },
  {
    src: "/images/21-patio-stamped-herringbone-firepit.jpg",
    alt: "Stamped concrete patio with herringbone pattern and a built-in firepit",
  },
  {
    src: "/images/28-sidewalk-fresh-pour-with-tape.jpg",
    alt: "Freshly poured concrete sidewalk roped off with caution tape",
  },
  {
    src: "/images/30-pickleball-court-aerial.jpg",
    alt: "Aerial view of a finished concrete pickleball court",
  },
  {
    src: "/images/36-process-trowel-action.jpg",
    alt: "Crew member troweling fresh concrete during a pour",
  },
] as const;

function RecentProjects() {
  return (
    <section
      id="recent"
      className="scroll-mt-20 bg-cream-50 py-12 sm:py-16 sm:scroll-mt-24"
      aria-labelledby="recent-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mb-8 max-w-3xl sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            Recent work · San Diego County
          </p>
          <h2
            id="recent-heading"
            className="mt-1 text-3xl font-extrabold text-brand-900 sm:text-4xl"
          >
            Recent work in San Diego
          </h2>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECENT_PROJECT_PHOTOS.map((p) => (
            <li
              key={p.src}
              className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── 7. Lead form ───────────────────────────────────────────────────────

function LeadFormBlock() {
  return (
    <section
      id="quote"
      className="scroll-mt-20 bg-cream-50 py-14 sm:py-20 sm:scroll-mt-24"
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
            Tell us about the job. We&apos;ll text you a confirmation and
            Ronnie will call you within the hour.
          </p>
        </header>
        <LeadForm compact />
      </div>
    </section>
  );
}
