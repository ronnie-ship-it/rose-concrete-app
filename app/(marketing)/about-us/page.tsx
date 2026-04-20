import type { Metadata } from "next";
import Link from "next/link";
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

const TITLE = "About Rose Concrete — Veteran-Owned San Diego Concrete Contractor";
const DESCRIPTION =
  "Family-run, veteran-owned San Diego concrete contractor. Ronnie Rose pours every job himself with an in-house crew. CA License #1130763, fully insured.";

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
            Family-run, veteran-owned,{" "}
            <span className="text-accent-600">no subcontracting.</span>
          </>
        }
        sub={
          <>
            Ronnie Rose pours every job himself with the same in-house crew.
            The person you hire on day one is the person standing in your
            driveway on pour day.
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

      {/* The story */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Our story"
          title="Built on showing up"
        />
        <div className="prose prose-lg max-w-3xl text-brand-700 [&_p]:mt-4">
          <p>
            {BUSINESS_NAME} is a family-run concrete contractor based in San
            Diego County. Ronnie Rose owns the company and runs every job in
            the field — same hands from the quote to the final walk-through,
            same in-house crew on every pour.
          </p>
          <p>
            The reason we don&apos;t subcontract is simple: subcontracting is
            where most concrete jobs go sideways. The crew you met during the
            quote isn&apos;t the crew that shows up. The finish you saw on the
            sample isn&apos;t the finish you get on your slab. The warranty
            conversation gets passed around like a hot potato. We don&apos;t
            run our company that way.
          </p>
          <p>
            The way we run it instead: Ronnie does every site visit. Same
            in-house crew on every job. Fixed-price quotes in writing.
            Workmanship warranty in writing. If something isn&apos;t right
            after the pour, you call us, we come back.
          </p>
        </div>
      </Section>

      {/* Veteran-owned */}
      <Section tone="white">
        <SectionHeader
          eyebrow="Veteran-owned"
          title="What that actually means for your job"
        />
        <div className="prose prose-lg max-w-3xl text-brand-700 [&_p]:mt-4">
          <p>
            Veteran-owned is more than a tagline on the truck. It&apos;s the
            reason our schedule actually holds, why our quotes are in writing,
            and why our walk-throughs include a real punch list instead of a
            shrug and a wave goodbye.
          </p>
          <p>
            The Navy taught us to plan an op, communicate the plan, and
            execute the plan on time. We run jobs the same way: written
            quote, written schedule, daily texts on what&apos;s happening
            today and tomorrow, and a clean walk-through with you at the end.
          </p>
        </div>
      </Section>

      {/* Licenses + insurance */}
      <Section tone="cream">
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
