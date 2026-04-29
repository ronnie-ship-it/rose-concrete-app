import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/marketing/lead-form";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { ServiceAreaList } from "@/components/marketing/service-area-list";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { IncludedList } from "@/components/marketing/included-list";
import { ProcessSteps } from "@/components/marketing/process-steps";
import { FaqSection } from "@/components/marketing/faq-section";
import { RelatedLinks } from "@/components/marketing/related-links";
import { SocialProof } from "@/components/marketing/social-proof";
import { RecentProjects } from "@/components/marketing/recent-projects";
import { TypicalCost } from "@/components/marketing/typical-cost";
import {
  LANDING_PAGES,
  landingPageBySlug,
} from "@/lib/marketing/landing-pages";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  serviceJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

/**
 * Dynamic landing page — one template, 10 routes.
 *
 * Differs from the service template in two ways:
 *   1. Form sits ABOVE the fold (in the hero's right column) — landing
 *      pages are paid-traffic destinations, every visitor needs to see
 *      the form without scrolling.
 *   2. Adds a "Timeline" and "Cost context" section between What-You-Get
 *      and FAQs. Landing pages target visitors with specific intent
 *      ("I got a city notice"); they need timeline + cost reassurance
 *      that service overview pages don't dwell on.
 *
 * All copy lives in lib/marketing/landing-pages.ts.
 */

export function generateStaticParams() {
  return LANDING_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = landingPageBySlug(slug);
  if (!page) return {};
  const url = `${SITE_ORIGIN}/landing/${page.slug}`;
  return {
    title: { absolute: page.metaTitle },
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: "website",
      url,
      siteName: "Rose Concrete",
      images: [
        {
          url: `${SITE_ORIGIN}/og-default.png`,
          width: 1200,
          height: 630,
          alt: page.h1,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
      images: [`${SITE_ORIGIN}/og-default.png`],
    },
  };
}

export default async function LandingPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = landingPageBySlug(slug);
  if (!page) notFound();

  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    serviceJsonLd({
      name: page.h1,
      description: page.metaDescription,
      pathSegment: `landing/${page.slug}`,
      serviceType: page.name,
    }),
    faqJsonLd(page.faqs),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: page.category, href: "/" },
      { name: page.name, href: `/landing/${page.slug}` },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Breadcrumb (visible) */}
      <nav
        aria-label="Breadcrumb"
        className="border-b border-brand-100 bg-cream-50/50"
      >
        <ol className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-3 text-xs text-brand-700/70 sm:px-6">
          <li>
            <Link href="/" className="hover:text-accent-600">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-brand-700">{page.category}</li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-brand-800" aria-current="page">
            {page.name}
          </li>
        </ol>
      </nav>

      {/* Hero — form in the right column, above the fold. */}
      <PageHero
        eyebrow={page.heroEyebrow}
        title={page.h1}
        sub={page.heroSub}
        formProps={{
          defaultServiceType: page.serviceTypeForForm,
          eyebrow: "Free · No obligation · 60 seconds",
          title: "Get Your Free Quote in 60 Seconds",
        }}
      />

      {/* Trust badges */}
      <Section tone="white" className="py-8 sm:py-10">
        <TrustBadges />
      </Section>

      {/* Intro */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="The honest answer"
          title={`What ${page.name.toLowerCase()} actually means for your home`}
        />
        <div className="prose prose-lg max-w-3xl text-brand-700">
          {page.intro.split("\n\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-4" : undefined}>
              {p}
            </p>
          ))}
        </div>
      </Section>

      {/* Optional callout (eligibility, programs, etc.) */}
      {page.callout && (
        <Section tone="white" className="py-8 sm:py-10">
          <div className="rounded-xl border-l-4 border-accent-500 bg-accent-50/60 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
              Heads up
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-brand-900">
              {page.callout.title}
            </h3>
            <p className="mt-2 text-base text-brand-800">
              {page.callout.body}
            </p>
          </div>
        </Section>
      )}

      {/* What you get */}
      <Section tone="white">
        <SectionHeader
          eyebrow="What you get"
          title="Every job, every time"
          sub="No surprise add-ons. Everything below is in the quote."
        />
        <IncludedList items={page.whatYouGet} />
      </Section>

      {/* Process */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="How it works"
          title="Start to finish"
        />
        <ProcessSteps steps={page.process} />
      </Section>

      {/* Timeline */}
      <Section tone="white">
        <SectionHeader
          eyebrow="Timeline"
          title="What to expect, week by week"
        />
        <div className="overflow-hidden rounded-xl border border-brand-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  Phase
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  Duration
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  Note
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 bg-white">
              {page.timeline.map((row) => (
                <tr key={row.phase}>
                  <td className="px-4 py-3 font-bold text-brand-900">
                    {row.phase}
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent-700">
                    {row.duration}
                  </td>
                  <td className="px-4 py-3 text-brand-700">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Cost — rich pricing block when typicalCost is set, otherwise
          the legacy paragraph-only fallback. */}
      <Section tone="cream">
        {page.typicalCost ? (
          <TypicalCost {...page.typicalCost} />
        ) : (
          <>
            <SectionHeader
              eyebrow="What it costs"
              title="Cost depends on the job — here's why"
              sub="We don't publish flat-rate prices because honest concrete pricing depends on what you have today and what you want next. Here's what drives the number."
            />
            <p className="max-w-3xl text-base leading-relaxed text-brand-800">
              {page.costContext}
            </p>
          </>
        )}
      </Section>

      {/* Social proof */}
      <Section tone="white">
        <SocialProof />
      </Section>

      {/* Recent work — filtered to this landing page's service type(s).
          Falls back to the placeholder grid when no real Finals match.
          Multi-type pages (e.g. safe-sidewalks-program covers walkway +
          sidewalk + safe_sidewalks_program) declare the array via
          `serviceTypesForGallery` on the LandingPage entry; otherwise the
          gallery filters on `[serviceTypeForForm]`. */}
      <Section tone="cream">
        <RecentProjects
          heading={`Recent ${page.name.toLowerCase()} work`}
          sub={`Real ${page.name.toLowerCase()} projects poured by Ronnie's crew across San Diego County.`}
          count={3}
          serviceTypes={
            page.serviceTypesForGallery ?? [page.serviceTypeForForm]
          }
        />
      </Section>

      {/* Service areas */}
      <ServiceAreaList
        heading={`We pour ${page.name.toLowerCase()} across San Diego County`}
        subhead="Same crew, same warranty, same Ronnie — no matter the city."
      />

      {/* FAQs */}
      <Section tone="white">
        <SectionHeader
          eyebrow="FAQ"
          title={`${page.name} questions, answered`}
        />
        <FaqSection faqs={page.faqs} />
      </Section>

      {/* Related */}
      {page.related && page.related.length > 0 && (
        <Section tone="cream">
          <RelatedLinks
            heading="Related work we do"
            items={page.related}
          />
        </Section>
      )}

      <FinalCallCta />
    </>
  );
}
