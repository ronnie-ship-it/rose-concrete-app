import type { Metadata } from "next";
import Image from "next/image";
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
  CORE_SERVICES,
  relatedServices,
  serviceBySlug,
} from "@/lib/marketing/services";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  serviceJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

/**
 * Dynamic service page — one template, 7 routes.
 *
 * All copy lives in lib/marketing/services.ts. This file is just the
 * layout + schema wiring. Editing service copy means editing the config
 * file, not this template.
 *
 * Pre-rendered at build time via generateStaticParams — so each /services/<slug>
 * is a static HTML doc on the CDN, fastest possible LCP for SEO.
 */

// Slug → Review.service category for SocialProof filtering.
const SLUG_TO_REVIEW_CAT: Record<
  string,
  "driveway" | "patio" | "sidewalk" | "decorative" | "pool_deck" | "rv_pad" | "retaining_wall" | "other"
> = {
  driveways: "driveway",
  patios: "patio",
  "walkways-sidewalks": "sidewalk",
  "decorative-concrete": "decorative",
  "exposed-aggregate": "decorative",
  paving: "other",
  "retaining-walls": "retaining_wall",
};

export function generateStaticParams() {
  return CORE_SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return {};
  const url = `${SITE_ORIGIN}/services/${service.slug}`;
  return {
    // Bare h1 — the (marketing) layout's title.template appends
    // "| Rose Concrete". Including it here doubled the brand suffix.
    title: service.h1,
    description: service.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${service.h1} | Rose Concrete`,
      description: service.metaDescription,
      type: "website",
      url,
      siteName: "Rose Concrete",
      images: [
        {
          url: `${SITE_ORIGIN}/og-default.png`,
          width: 1200,
          height: 630,
          alt: service.h1,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.h1} | Rose Concrete`,
      description: service.metaDescription,
      images: [`${SITE_ORIGIN}/og-default.png`],
    },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();

  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    serviceJsonLd({
      name: service.h1,
      description: service.metaDescription,
      pathSegment: `services/${service.slug}`,
      serviceType: service.name,
    }),
    faqJsonLd(service.faqs),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Services", href: "/services" },
      { name: service.name, href: `/services/${service.slug}` },
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
            <Link href="/" className="hover:text-accent-600">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/services" className="hover:text-accent-600">
              Services
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-brand-800" aria-current="page">
            {service.name}
          </li>
        </ol>
      </nav>

      {/* Hero — form sits in right column above the fold by default. */}
      <PageHero
        eyebrow={service.heroEyebrow}
        title={service.h1}
        sub={service.heroSub}
        formProps={{
          defaultServiceType: service.serviceTypeForForm,
          title: `Free ${service.name} Quote — 60 Seconds`,
        }}
      />

      {/* Trust */}
      <Section tone="white" className="py-8 sm:py-10">
        <TrustBadges />
      </Section>

      {/* Intro */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Overview"
          title={`What we do for ${service.name.toLowerCase()}`}
        />
        <div className="prose prose-lg max-w-3xl text-brand-700">
          {service.intro.split("\n\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-4" : undefined}>
              {p}
            </p>
          ))}
        </div>
      </Section>

      {/* What's included */}
      <Section tone="white">
        <SectionHeader
          eyebrow="What's included"
          title="Every job, every time"
          sub="No surprise add-ons after we shake hands."
        />
        <IncludedList items={service.whatsIncluded} />
      </Section>

      {/* Process */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Our process"
          title="From first call to final walk-through"
        />
        <ProcessSteps steps={service.process} />
      </Section>

      {/* Why us */}
      <Section tone="white">
        <SectionHeader
          eyebrow="Why Rose Concrete"
          title="Why hire us"
        />
        <p className="max-w-3xl text-lg text-brand-700">{service.whyUs}</p>
        <div className="mt-8">
          <TrustBadges variant="inline" />
        </div>
      </Section>

      {/* Typical cost */}
      {service.typicalCost && (
        <Section tone="cream">
          <TypicalCost {...service.typicalCost} formAnchorHref="#quote-bottom" />
        </Section>
      )}

      {/* Social proof */}
      <Section tone="white">
        <SocialProof
          serviceFilter={SLUG_TO_REVIEW_CAT[service.slug]}
          heading={`What ${service.name.toLowerCase()} customers say`}
        />
      </Section>

      {/* Recent projects. When the service config carries a curated
          staticGallery (hand-picked photos in /public/images/), render
          that — same pattern as the home-page grid. Otherwise fall back
          to the project_media query filtered to this service's enum
          value(s). Combined pages like walkways-sidewalks pass an array
          via `serviceTypesForGallery` so all flavors of the work surface. */}
      <Section tone="cream">
        {service.staticGallery ? (
          <StaticGallery
            heading={`Recent ${service.name.toLowerCase()} work`}
            sub={`Real ${service.name.toLowerCase()} work poured by Ronnie's crew across San Diego County.`}
            photos={service.staticGallery}
          />
        ) : (
          <RecentProjects
            heading={`Recent ${service.name.toLowerCase()} work`}
            sub={`Real ${service.name.toLowerCase()} work poured by Ronnie's crew across San Diego County.`}
            serviceTypes={
              service.serviceTypesForGallery ?? [service.serviceTypeForForm]
            }
          />
        )}
      </Section>

      {/* Service areas */}
      <ServiceAreaList
        heading={`We pour ${service.name.toLowerCase()} across San Diego County`}
        subhead="Same crew, same warranty, no matter the city."
      />

      {/* Closing form — second chance for visitors who scrolled past the
          hero form. id="quote-bottom" so we don't collide with the hero
          form's id="quote". */}
      <Section id="quote-bottom" tone="white">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Free · No obligation · 60 seconds"
            title={`Get Your Free ${service.name} Quote`}
            sub="Tell us about the job. We text you a confirmation immediately. Ronnie calls back as soon as he can."
            className="text-center sm:mx-auto"
          />
          <LeadForm compact defaultServiceType={service.serviceTypeForForm} />
        </div>
      </Section>

      {/* FAQs */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="FAQ"
          title={`${service.name} questions, answered`}
        />
        <FaqSection faqs={service.faqs} />
      </Section>

      {/* Related */}
      <Section tone="white">
        <RelatedLinks
          heading="Other concrete services we offer"
          items={relatedServices(service.slug).map((s) => ({
            href: `/services/${s.slug}`,
            title: s.name,
            sub: s.shortDescription,
          }))}
        />
      </Section>

      <FinalCallCta />
    </>
  );
}

/**
 * Curated static photo grid — mirrors the home-page RecentProjects
 * grid (fixed aspect, next/image, 3-col on lg+). Rendered when the
 * service config provides `staticGallery`.
 */
function StaticGallery({
  heading,
  sub,
  photos,
}: {
  heading: string;
  sub: string;
  photos: readonly { src: string; alt: string }[];
}) {
  return (
    <div>
      <header className="mb-6 max-w-3xl sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          Recent work · 2025–2026
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-brand-900 sm:text-3xl">
          {heading}
        </h2>
        <p className="mt-2 text-base text-brand-700/80">{sub}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
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
  );
}
