import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeader } from "@/components/marketing/section";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { ServiceAreaList } from "@/components/marketing/service-area-list";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { LeadForm } from "@/components/marketing/lead-form";
import { CORE_SERVICES } from "@/lib/marketing/services";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

const TITLE =
  "Concrete Services in San Diego — Driveways, Patios, Sidewalks & More | Rose Concrete";
const DESCRIPTION =
  "Full list of concrete services Rose Concrete pours across San Diego County. Driveways, patios, walkways, decorative, exposed aggregate, paving, and retaining walls. CA License #1130763.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/services` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/services`,
    siteName: "Rose Concrete",
    images: [
      { url: `${SITE_ORIGIN}/og-default.png`, width: 1200, height: 630 },
    ],
  },
};

export default function ServicesIndex() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Services", href: "/services" },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Section tone="cream" className="border-b border-brand-100 pt-10 sm:pt-14">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          Services · San Diego County
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
          Every concrete job we pour, in one place.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-brand-700">
          Pick the service that fits your project for scope, process, FAQs, and a free quote. Don&apos;t see it? Call us — odds are we do it.
        </p>
        <div className="mt-8">
          <TrustBadges />
        </div>
      </Section>

      <Section tone="white">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_SERVICES.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/services/${s.slug}`}
                className="group flex h-full flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm transition hover:border-accent-400 hover:shadow-md"
              >
                <h2 className="text-xl font-extrabold text-brand-900 group-hover:text-accent-700">
                  {s.name}
                </h2>
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
      </Section>

      <ServiceAreaList />

      <Section id="quote" tone="white">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Free · No obligation"
            title="Get a free quote"
            sub="Tell us about the job. We'll text you a confirmation and Ronnie will call within the hour."
            className="text-center sm:mx-auto"
          />
          <LeadForm compact />
        </div>
      </Section>

      <FinalCallCta />
    </>
  );
}
