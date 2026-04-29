import type { Metadata } from "next";
import Link from "next/link";
// next/image will be reintroduced when /public/images/ronnie-and-lacy.jpg
// lands. See the photo placeholder section below for the swap site.
import { Section, SectionHeader } from "@/components/marketing/section";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { ServiceAreaList } from "@/components/marketing/service-area-list";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { LeadForm } from "@/components/marketing/lead-form";
import { PageHero } from "@/components/marketing/page-hero";
import {
  BUSINESS_NAME,
  LICENSE,
  PHONE_DISPLAY,
} from "@/lib/marketing/brand";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

/**
 * About page — warmer, more personal than the original v1.
 *
 * Scaffold dropped 2026-04-28 with placeholder TODO comments where
 * Ronnie needs to write personal narrative. Dev-only amber banners
 * surface the gaps locally + on Vercel previews; nothing TODO-ish
 * renders in production (NODE_ENV check below).
 *
 * What Ronnie still needs to provide before launch:
 *   1. Photo at /public/images/ronnie-and-lacy.jpg (or update path below)
 *   2. Personal narrative paragraph (military, family, why-concrete)
 *   3. Anything else flagged by TodoBanner below
 *
 * Old Duda site About content was NOT preserved in the migration capture
 * (duda-site-content/pages/ is empty). Best the inventory file gave us
 * was the meta description: "Learn about our licensed San Diego concrete
 * team and values."
 */

const TITLE = "About Rose Concrete — Family-Run, Veteran-Owned Concrete Contractor in San Diego";
const DESCRIPTION =
  "Rose Concrete and Development is a family-run, veteran-owned concrete contractor in San Diego County. Meet Ronnie Rose, his crew, and how we run jobs.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/about-us` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/about-us`,
    siteName: "Rose Concrete",
    images: [
      { url: `${SITE_ORIGIN}/og-default.png`, width: 1200, height: 630 },
    ],
  },
};

const IS_PROD = process.env.NODE_ENV === "production";

/** Dev-only banner — invisible in production, loud in dev/preview. */
function TodoBanner({ children }: { children: React.ReactNode }) {
  if (IS_PROD) return null;
  return (
    <div className="my-3 rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
      <strong className="block uppercase tracking-wider">
        TODO (dev only — invisible in production):
      </strong>
      <span>{children}</span>
    </div>
  );
}

export default function AboutPage() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "About", href: "/about-us" },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="border-b border-brand-100 bg-cream-50/50"
      >
        <ol className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-3 text-xs text-brand-700/70 sm:px-6">
          <li>
            <Link href="/" className="hover:text-accent-600">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-brand-800" aria-current="page">
            About
          </li>
        </ol>
      </nav>

      <PageHero
        eyebrow="About · San Diego County"
        title={
          <>
            Concrete that lasts —{" "}
            <span className="text-accent-600">poured by the same crew, every job.</span>
          </>
        }
        sub={
          <>
            Rose Concrete is family-run and veteran-owned. Ronnie Rose pours
            every job in the field with the same in-house crew. The person
            you hire on day one is the person standing in your driveway on
            pour day.
          </>
        }
        formProps={{
          title: "Talk to Ronnie",
        }}
      />

      {/* Trust */}
      <Section tone="white" className="py-8 sm:py-10">
        <TrustBadges />
      </Section>

      {/* Meet Ronnie + Lacy */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Meet the family"
          title="Ronnie and Lacy Rose"
        />
        <div className="grid gap-8 md:grid-cols-[2fr,3fr] md:items-center">
          {/* Photo slot */}
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-brand-100 bg-brand-50 shadow-sm">
            {/*
              Real photo lives at /public/images/ronnie-and-lacy.jpg.
              Until then this renders the cream-tinted placeholder
              gradient with a subtle "PHOTO HERE" label visible only
              in dev. In production, just a colored block — no broken
              image, no error.
            */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, #f5efe0 0%, #d7dde9 100%)",
              }}
            />
            {!IS_PROD && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-xs font-mono text-brand-700/70">
                <div>
                  <p className="font-bold uppercase tracking-wider">
                    Photo placeholder
                  </p>
                  <p className="mt-1">
                    Drop file at:
                    <br />
                    <code>/public/images/ronnie-and-lacy.jpg</code>
                  </p>
                </div>
              </div>
            )}
            {/*
              When Ronnie drops the photo, swap the placeholder block
              above with this <Image>:

              <Image
                src="/images/ronnie-and-lacy.jpg"
                alt="Ronnie and Lacy Rose"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            */}
          </div>

          {/* Narrative */}
          <div className="prose prose-lg max-w-none text-brand-700 [&_p]:mt-4">
            <p>
              Rose Concrete and Development is the work of one family.{" "}
              {BUSINESS_NAME.split(" and ")[0]} — Ronnie Rose — runs every job
              in the field with an in-house crew, and his wife Lacy keeps the
              business side honest.
            </p>

            <TodoBanner>
              Need 2-3 sentences from Ronnie about military background (Navy?
              dates? role?), where he and Lacy met, when they moved to San
              Diego, and what made him start the company. Keep this honest
              and specific — generic boilerplate hurts credibility more than
              it helps. Replace the paragraph below with the real story.
            </TodoBanner>

            <p>
              Ronnie spent his early career in the Navy before turning to
              concrete full-time. The discipline of military planning shaped
              how he runs jobs today: written quote, written schedule, daily
              text updates on what&apos;s happening that day, and a clean
              walk-through with you at the end.
            </p>

            <TodoBanner>
              Optional: 1-2 sentences about kids, dogs, where in San Diego
              they live, what Ronnie does outside of pouring concrete. Skip
              entirely if you&apos;d rather keep it private — &ldquo;family
              business&rdquo; sentiment lands either way.
            </TodoBanner>

            <p>
              They live in San Diego, raise a family here, and pour concrete
              for neighbors all over the county.
            </p>
          </div>
        </div>
      </Section>

      {/* How we run jobs */}
      <Section tone="white">
        <SectionHeader
          eyebrow="How we work"
          title="Same crew, every job — start to finish"
        />
        <div className="prose prose-lg max-w-3xl text-brand-700 [&_p]:mt-4">
          <p>
            How we run a job: Ronnie does every site visit himself. The same
            in-house crew is on every pour. Quotes are fixed-price and in
            writing. The workmanship warranty is in writing. If something
            isn&apos;t right after the pour, you call us, we come back.
          </p>
          <p>
            The Navy taught us to plan an op, communicate the plan, and
            execute the plan on time. We run jobs the same way: written
            quote, written schedule, daily texts on what&apos;s happening
            today and tomorrow, and a clean walk-through with you at the
            end.
          </p>
        </div>
      </Section>

      {/* Why concrete (optional section) */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Why concrete"
          title="What drew us to flatwork"
        />
        <div className="prose prose-lg max-w-3xl text-brand-700 [&_p]:mt-4">
          <TodoBanner>
            Optional but valuable: 2-3 sentences about why you specifically
            chose concrete vs. another trade. Did you grow up around it?
            Apprentice with someone? See an industry gap? This is where
            personal craft credibility lives.
          </TodoBanner>
          <p>
            Concrete is a trade where a 30-year slab and a 5-year crack-fest
            come from the same materials. The difference is in the prep, the
            rebar, the joint spacing, the cure window. We pour the way you
            do when the warranty has your own name on it — because ours
            does.
          </p>
        </div>
      </Section>

      {/* Licenses + insurance */}
      <Section tone="white">
        <SectionHeader
          eyebrow="Credentials"
          title="License, insurance, and bonding"
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
              License
            </p>
            <p className="mt-2 text-lg font-extrabold text-brand-900">
              {LICENSE}
            </p>
            <p className="mt-1 text-sm text-brand-700/80">
              California Contractors State License Board.
            </p>
          </div>
          <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
              Insurance
            </p>
            <p className="mt-2 text-lg font-extrabold text-brand-900">
              Fully Insured
            </p>
            <p className="mt-1 text-sm text-brand-700/80">
              General liability + workers&apos; comp on every crew member.
              Insurance certificates available on request.
            </p>
          </div>
          <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
              Bonded
            </p>
            <p className="mt-2 text-lg font-extrabold text-brand-900">
              CSLB Surety Bond
            </p>
            <p className="mt-1 text-sm text-brand-700/80">
              California contractor surety bond per CSLB requirement.
            </p>
          </div>
        </div>
      </Section>

      {/* Service areas */}
      <ServiceAreaList />

      {/* Closing form */}
      <Section id="quote-bottom" tone="white">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Free · No obligation · 60 seconds"
            title="Talk to Ronnie about your project"
            sub={`Tell us about the job. We text you a confirmation immediately. Or call ${PHONE_DISPLAY} directly.`}
            className="text-center sm:mx-auto"
          />
          <LeadForm compact />
        </div>
      </Section>

      <FinalCallCta />
    </>
  );
}
