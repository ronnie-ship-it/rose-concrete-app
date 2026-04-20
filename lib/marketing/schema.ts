/**
 * schema.org JSON-LD helpers for the marketing site.
 *
 * Every marketing page renders LocalBusiness so Google has a consistent
 * organization graph regardless of the entry point. Service pages and
 * landing pages additionally render a Service entity that links back to
 * the LocalBusiness via `provider`.
 *
 * Output is a plain object — pages embed it via:
 *
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
 *   />
 *
 * which is the pattern Next's metadata API recommends (the `metadata`
 * export doesn't yet support arbitrary JSON-LD).
 */

import {
  BUSINESS_NAME,
  EMAIL,
  GOOGLE_REVIEW_URL,
  LICENSE,
  PHONE_E164,
  SERVICE_AREAS,
  SHORT_NAME,
} from "./brand";

/** Public canonical origin. Override per-environment if needed. */
export const SITE_ORIGIN = "https://sandiegoconcrete.ai";

/**
 * LocalBusiness / HomeAndConstructionBusiness graph node.
 *
 * Notes:
 *   - `@type` is the union ['LocalBusiness', 'HomeAndConstructionBusiness']
 *     so Google indexes us under both. `HomeAndConstructionBusiness` is the
 *     more specific subclass and triggers the "service area business"
 *     pattern in Search Console.
 *   - `address` uses a postal address with no street — Rose Concrete is a
 *     service-area business, not a storefront. Google specifically supports
 *     this pattern and will not show the address publicly.
 *   - `areaServed` lists every city in `SERVICE_AREAS`, each as an
 *     AdministrativeArea, so the city/service-area pages can link back here.
 */
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
    "@id": `${SITE_ORIGIN}/#org`,
    name: BUSINESS_NAME,
    alternateName: SHORT_NAME,
    url: SITE_ORIGIN,
    telephone: PHONE_E164,
    email: EMAIL,
    image: `${SITE_ORIGIN}/og-default.png`,
    logo: `${SITE_ORIGIN}/icon-512.png`,
    priceRange: "$$",
    description:
      "Family-run, veteran-owned concrete contractor serving San Diego " +
      "County. Driveways, patios, sidewalks, decorative concrete, and the " +
      "Safe Sidewalks Program. " +
      LICENSE +
      ", fully insured, in-house crew (no subcontracting).",
    address: {
      "@type": "PostalAddress",
      addressLocality: "San Diego",
      addressRegion: "CA",
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 32.7157,
      longitude: -117.1611,
    },
    areaServed: SERVICE_AREAS.map((city) => ({
      "@type": "AdministrativeArea",
      name: `${city}, CA`,
    })),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "07:00",
        closes: "19:00",
      },
    ],
    sameAs: [
      // Google Business Profile — the canonical "leave a review" short
      // link from Ronnie's GBP "Get more reviews" panel. Including this
      // in `sameAs` is how Google ties this LocalBusiness JSON-LD back
      // to the GBP listing for review aggregation in search results.
      GOOGLE_REVIEW_URL,
      // Add real social profiles here as they come online.
    ],
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "license",
      name: LICENSE,
      recognizedBy: {
        "@type": "Organization",
        name: "California Contractors State License Board",
      },
    },
  };
}

/** Service entity — link from a service page back to the LocalBusiness. */
export function serviceJsonLd(input: {
  name: string;
  description: string;
  /** Full path segment, e.g. `services/driveways` or `landing/safe-sidewalks-program-san-diego`. */
  pathSegment: string;
  serviceType?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    serviceType: input.serviceType ?? input.name,
    provider: { "@id": `${SITE_ORIGIN}/#org` },
    areaServed: SERVICE_AREAS.map((city) => ({
      "@type": "AdministrativeArea",
      name: `${city}, CA`,
    })),
    url: `${SITE_ORIGIN}/${input.pathSegment}`,
  };
}

/** FAQPage entity — emit alongside the FaqSection on any page with FAQs. */
export function faqJsonLd(faqs: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

/** Breadcrumb chain — Home → Section → Page. */
export function breadcrumbJsonLd(items: readonly { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.href.startsWith("http") ? it.href : `${SITE_ORIGIN}${it.href}`,
    })),
  };
}

/**
 * Bundle multiple JSON-LD nodes into a single @graph payload — fewer
 * <script> tags, same SEO outcome.
 */
export function jsonLdGraph(nodes: object[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.map((n) => {
      // Strip duplicate top-level @context fields when bundling.
      const { "@context": _ctx, ...rest } = n as { "@context"?: string };
      void _ctx;
      return rest;
    }),
  };
}
