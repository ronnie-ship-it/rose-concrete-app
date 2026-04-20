import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeader } from "@/components/marketing/section";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { LeadForm } from "@/components/marketing/lead-form";
import { SERVICE_AREA_PAGES } from "@/lib/marketing/service-areas";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

const TITLE =
  "Service Areas — Rose Concrete San Diego County";
const DESCRIPTION =
  "Rose Concrete pours across San Diego County — from National City and Chula Vista in the South Bay up through Solana Beach and University City in the North. CA License #1130763.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/service-areas` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/service-areas`,
    siteName: "Rose Concrete",
    images: [
      { url: `${SITE_ORIGIN}/og-default.png`, width: 1200, height: 630 },
    ],
  },
};

export default function ServiceAreasIndex() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Service Areas", href: "/service-areas" },
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
          Service areas · San Diego County
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
          We pour concrete across San Diego County.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-brand-700">
          12 cities, one in-house crew, same warranty. Tap your city for what
          we typically pour there and what makes the local concrete situation
          different.
        </p>
        <div className="mt-8">
          <TrustBadges />
        </div>
      </Section>

      <Section tone="white">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_AREA_PAGES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/service-areas/${a.slug}`}
                className="group flex h-full flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm transition hover:border-accent-400 hover:shadow-md"
              >
                <h2 className="text-xl font-extrabold text-brand-900 group-hover:text-accent-700">
                  {a.city}
                </h2>
                {a.zipCodes && (
                  <p className="mt-1 text-xs text-brand-700/70">
                    {a.zipCodes.join(" · ")}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 group-hover:text-accent-700">
                  See {a.city} concrete work
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="quote" tone="cream">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Free · No obligation"
            title="Get a free quote"
            sub="Tell us where you are and what you need. We'll text you a confirmation and Ronnie will call within the hour."
            className="text-center sm:mx-auto"
          />
          <LeadForm compact />
        </div>
      </Section>

      <FinalCallCta />
    </>
  );
}
