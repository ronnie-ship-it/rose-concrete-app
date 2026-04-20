import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/marketing/lead-form";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { RelatedLinks } from "@/components/marketing/related-links";
import { SocialProof } from "@/components/marketing/social-proof";
import {
  SERVICE_AREA_PAGES,
  serviceAreaBySlug,
} from "@/lib/marketing/service-areas";
import { CORE_SERVICES } from "@/lib/marketing/services";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

/**
 * Dynamic service-area page — one template, 12 routes.
 *
 * All copy lives in lib/marketing/service-areas.ts. The 7 service links
 * pull from lib/marketing/services.ts so adding a service automatically
 * propagates to every area page.
 */

export function generateStaticParams() {
  return SERVICE_AREA_PAGES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = serviceAreaBySlug(slug);
  if (!area) return {};
  const url = `${SITE_ORIGIN}/service-areas/${area.slug}`;
  return {
    title: { absolute: area.metaTitle },
    description: area.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: area.metaTitle,
      description: area.metaDescription,
      type: "website",
      url,
      siteName: "Rose Concrete",
      images: [
        {
          url: `${SITE_ORIGIN}/og-default.png`,
          width: 1200,
          height: 630,
          alt: area.h1,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: area.metaTitle,
      description: area.metaDescription,
      images: [`${SITE_ORIGIN}/og-default.png`],
    },
  };
}

export default async function ServiceAreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = serviceAreaBySlug(slug);
  if (!area) notFound();

  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Service Areas", href: "/service-areas" },
      { name: area.city, href: `/service-areas/${area.slug}` },
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
          <li>
            <Link href="/service-areas" className="hover:text-accent-600">
              Service Areas
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-brand-800" aria-current="page">
            {area.city}
          </li>
        </ol>
      </nav>

      {/* Hero — form sits above the fold in right column. */}
      <PageHero
        eyebrow={`${area.city}, CA · San Diego County`}
        title={area.h1}
        sub={
          <>
            Same in-house crew, same warranty, same Ronnie — pouring concrete
            for {area.city} homeowners every week.
          </>
        }
        formProps={{
          title: `Free Quote in ${area.city}`,
        }}
      />

      {/* Trust */}
      <Section tone="white" className="py-8 sm:py-10">
        <TrustBadges />
      </Section>

      {/* Local context */}
      <Section tone="cream">
        <SectionHeader
          eyebrow={`What's typical in ${area.city}`}
          title={`Concrete work in ${area.city}`}
        />
        <div className="prose prose-lg max-w-3xl text-brand-700">
          {area.localContext.split("\n\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-4" : undefined}>
              {p}
            </p>
          ))}
        </div>
        {area.zipCodes && area.zipCodes.length > 0 && (
          <p className="mt-6 text-sm text-brand-700/70">
            <span className="font-bold">ZIP codes covered:</span>{" "}
            {area.zipCodes.join(" · ")}
          </p>
        )}
      </Section>

      {/* Services offered */}
      <Section tone="white">
        <SectionHeader
          eyebrow="Services"
          title={`What we pour in ${area.city}`}
          sub="Tap any service for full scope, process, FAQs, and a free quote."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_SERVICES.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/services/${s.slug}`}
                className="group flex h-full flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm transition hover:border-accent-400 hover:shadow-md"
              >
                <h3 className="text-lg font-extrabold text-brand-900 group-hover:text-accent-700">
                  {s.name}
                </h3>
                <p className="mt-2 text-sm text-brand-700/90">
                  {s.shortDescription}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 group-hover:text-accent-700">
                  See {s.name.toLowerCase()}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Why us in this area */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Why Rose Concrete"
          title={`Why ${area.city} homeowners pick us`}
        />
        <p className="max-w-3xl text-lg text-brand-700">{area.whyHere}</p>
        <div className="mt-8">
          <TrustBadges variant="inline" />
        </div>
      </Section>

      {/* Social proof */}
      <Section tone="white">
        <SocialProof
          heading={`Reviews from San Diego County homeowners`}
        />
      </Section>

      {/* Closing form — second chance after the page content. */}
      <Section id="quote-bottom" tone="white">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Free · No obligation · 60 seconds"
            title={`Get Your Free Quote in ${area.city}`}
            sub="Tell us about the job. We text a confirmation immediately. Ronnie calls back within 1 hour — guaranteed."
            className="text-center sm:mx-auto"
          />
          <LeadForm compact />
        </div>
      </Section>

      {/* Related areas */}
      <Section tone="cream">
        <RelatedLinks
          heading="Other San Diego cities we serve"
          items={SERVICE_AREA_PAGES.filter((a) => a.slug !== area.slug)
            .slice(0, 6)
            .map((a) => ({
              href: `/service-areas/${a.slug}`,
              title: `Concrete in ${a.city}`,
            }))}
        />
      </Section>

      <FinalCallCta />
    </>
  );
}
