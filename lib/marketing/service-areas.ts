/**
 * Single source of truth for the 12 service-area pages.
 *
 * Each entry powers /service-areas/<slug> with city-specific local
 * context (neighborhood character, typical jobs, what's distinctive
 * about pouring concrete here). Local-SEO oriented — a homeowner
 * Googling "concrete contractor coronado" lands on a page that
 * actually mentions Coronado, not just generic copy with the city
 * name swapped in.
 *
 * Used by:
 *   - app/(marketing)/service-areas/[slug]/page.tsx
 *   - app/(marketing)/service-areas/page.tsx
 *   - app/(marketing)/page.tsx (footer + grid)
 *   - components/marketing/footer.tsx
 *   - app/sitemap.ts
 */

import { SERVICE_AREAS } from "./brand";

export type ServiceArea = {
  /** Display name. */
  city: string;
  /** URL slug — matches /service-areas/<slug>. Lowercase, hyphenated. */
  slug: string;
  /** SEO meta title. */
  metaTitle: string;
  /** SEO meta description. */
  metaDescription: string;
  /** Hero H1. */
  h1: string;
  /** 2-paragraph local context — neighborhood character + what's typical for concrete here. */
  localContext: string;
  /** Why homeowners in THIS city choose Rose Concrete (3-4 sentences). */
  whyHere: string;
  /** Optional ZIP codes covered (helps local SEO). */
  zipCodes?: readonly string[];
};

// Slug helper — kept here so it's the single source of truth.
function slug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SERVICE_AREA_CONTENT: Record<string, Omit<ServiceArea, "city" | "slug">> = {
  "National City": {
    metaTitle: "Concrete Contractor in National City | Rose Concrete",
    metaDescription:
      "Concrete contractor serving National City. Driveways, patios, sidewalks, and private-pay sidewalk repair. Veteran-owned, CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in National City",
    localContext:
      "National City is one of the oldest cities in San Diego County, and the housing stock shows it — many of the single-family homes are decades old, which means a lot of original concrete is now hitting end-of-life. Cracked driveways, lifted sidewalks, and sunken aprons are the most common calls we get from National City homeowners.\n\nNote: the City of San Diego's Safe Sidewalks Program does NOT apply to National City — National City is its own incorporated city. Sidewalk repair here is private-pay. If you've gotten a sidewalk-related notice from National City directly, call us and we'll walk through what your options are.",
    whyHere:
      "We pour across National City regularly — the older neighborhoods west of I-805 especially. We know the typical driveway widths and which permits National City actually requires. Local enough to be efficient, in-house enough to be accountable.",
    zipCodes: ["91950"],
  },
  "City Heights": {
    metaTitle: "Concrete Contractor in City Heights, San Diego | Rose Concrete",
    metaDescription:
      "Concrete contractor in City Heights. Driveways, sidewalk repair, and small patios on tighter mid-city lots. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in City Heights",
    localContext:
      "City Heights is dense mid-city San Diego — older bungalows and Spanish revival homes on smaller lots, lots of detached single-car garages, and narrower-than-suburban driveways. The most common concrete jobs here are sidewalk repair (the city has been active on Safe Sidewalks Program notices), driveway replacement on tight lots, and small backyard patios where every square foot counts.\n\nOlder homes in City Heights often have original concrete from the 1920s-1940s, so the failures are deeper than just hairlines — many slabs need full tear-out rather than spot repair.",
    whyHere:
      "Tight lots, narrow access, and older sub-base conditions are normal for City Heights jobs — we handle them without surprise change orders. We know which streets the concrete truck can actually reach.",
    zipCodes: ["92105", "92115"],
  },
  "Solana Beach": {
    metaTitle: "Concrete Contractor in Solana Beach | Rose Concrete",
    metaDescription:
      "Concrete contractor in Solana Beach. Coastal driveways, decorative patios, pool decks. Veteran-owned. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in Solana Beach",
    localContext:
      "Solana Beach is North County coastal — beach-oriented architecture, expensive lots, and a strong preference for hardscape that matches the aesthetic of the home. Most calls here are for decorative driveways, stamped patios, and pool decks — homeowners aren't looking for the cheapest pour, they're looking for the one that holds up to ocean air and looks right.\n\nCoastal homes have specific concrete considerations — salt air can corrode under-spec rebar, and many lots have clay or fill that needs proper base prep before a slab will last.",
    whyHere:
      "We pour to coastal spec when the location calls for it — proper rebar coverage and finish work that matches the look of the home. Veteran-owned, fully insured, and Ronnie does every site visit himself.",
    zipCodes: ["92075"],
  },
  "University City": {
    metaTitle: "Concrete Contractor in University City, San Diego | Rose Concrete",
    metaDescription:
      "Concrete contractor in University City. Driveways, patios, retaining walls. Veteran-owned. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in University City",
    localContext:
      "University City — the residential area around UCSD, between I-5 and I-805 north of La Jolla — is largely a 1960s-1980s planned community. Driveways and walkways from that era are now hitting their second life cycle, and we get a steady stream of full-replacement and extension jobs from UC homeowners.\n\nMany University City lots have HOA design guidelines that affect what finishes are allowed. We work with the HOA's submittal package so the new work passes design review.",
    whyHere:
      "UC homeowners typically want the job done right and out of the way — we schedule tightly, communicate the day-by-day plan in writing, and clean up so you don't notice the crew was there.",
    zipCodes: ["92122"],
  },
  "La Mesa": {
    metaTitle: "Concrete Contractor in La Mesa | Rose Concrete",
    metaDescription:
      "Concrete contractor in La Mesa. Hillside driveways, retaining walls, and patios on sloped lots. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in La Mesa",
    localContext:
      "La Mesa is east-county hill country — older established neighborhoods on hillside lots, lots of mid-century homes with sloped driveways and grade-change patios. Retaining walls, hillside driveways, and properly drained patios are the bread-and-butter of what we pour in La Mesa.\n\nGrade and drainage are the main differences from a flat-lot pour. We design the slope and drainage into the quote — it's not an afterthought.",
    whyHere:
      "Hillside concrete is engineered work — proper footings, integrated drainage, and the right reinforcement so the slab doesn't slide downhill in five years. We've poured enough hillside La Mesa lots to know what works.",
    zipCodes: ["91941", "91942"],
  },
  "Chula Vista": {
    metaTitle: "Concrete Contractor in Chula Vista | Rose Concrete",
    metaDescription:
      "Concrete contractor in Chula Vista. Driveways, patios, RV pads, and sidewalk repair. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in Chula Vista",
    localContext:
      "Chula Vista is the largest city in the South Bay and a mix of older established neighborhoods and newer master-planned communities. Older Chula Vista (west of I-805) has 1950s-1970s housing with original concrete now failing; newer Chula Vista (Eastlake, Otay Ranch) has fewer driveway-replacement calls but plenty of patio extensions, RV pads, and pool decks.\n\nLot sizes are typically larger than central-city neighborhoods, which means bigger pours and more room for backyard hardscape projects.",
    whyHere:
      "Whether you're in old Chula Vista with a 60-year-old driveway about to fail or in a newer Eastlake home wanting a custom patio, same crew, same standards. We pour all over the South Bay — Bonita and Chula Vista are most weeks of the year.",
    zipCodes: ["91910", "91911", "91913", "91914", "91915"],
  },
  "El Cajon": {
    metaTitle: "Concrete Contractor in El Cajon | Rose Concrete",
    metaDescription:
      "Concrete contractor in El Cajon. Driveways, RV pads, patios, and retaining walls. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in El Cajon",
    localContext:
      "El Cajon is east-county inland — hotter than the coast, larger lots than central San Diego, and a strong demand for RV and trailer parking pads alongside the driveway. Many El Cajon homes also have hillside backyards that benefit from retaining walls and graded patios.\n\nThe heat means concrete cure timing matters more — we work mornings and evenings on the hottest summer pours so the slab cures evenly without surface cracks.",
    whyHere:
      "We adjust the pour schedule for El Cajon summer heat so you don't get a surface-cracked slab from a too-fast cure. Larger lots, RV-pad work, and hillside retaining — all common, all in the wheelhouse.",
    zipCodes: ["92019", "92020", "92021"],
  },
  "North Park": {
    metaTitle: "Concrete Contractor in North Park, San Diego | Rose Concrete",
    metaDescription:
      "Concrete contractor in North Park. Craftsman bungalow driveways, narrow walkways, and small patios. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in North Park",
    localContext:
      "North Park is a Craftsman bungalow neighborhood — narrow lots, detached single-car garages set back from the street, and lots of original 1920s-1940s concrete walkways and driveways that are at or past end-of-life. Most North Park calls are sidewalk repair, narrow-driveway replacement, and small backyard patios.\n\nNorth Park's history-conscious residents often want the new pour to feel period-appropriate — we can match scored patterns and traditional broom finishes that don't look out-of-place against a Craftsman home.",
    whyHere:
      "North Park's tight access and historic homes need a contractor who'll work without tearing up the front yard or dragging the truck through the bougainvillea. We do.",
    zipCodes: ["92104"],
  },
  "Clairemont": {
    metaTitle: "Concrete Contractor in Clairemont, San Diego | Rose Concrete",
    metaDescription:
      "Concrete contractor in Clairemont. Driveway and walkway replacement on mid-century homes. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in Clairemont",
    localContext:
      "Clairemont is a 1950s-1960s planned community — most homes are mid-century single-family on similar floor plans, which means a lot of similar concrete from the same era now reaching end-of-life. Driveway replacement and walkway-and-sidewalk work make up most of our Clairemont calls.\n\nThe original 1950s sub-base in Clairemont was often under-prepped by today's standards. When we re-pour we typically need to do additional base work to get the new slab to last another 50 years.",
    whyHere:
      "Clairemont needs a contractor who knows the original construction era and what the typical sub-base looks like — we re-prep properly so the new pour outlasts the original. No skipping base work to hit a low quote.",
    zipCodes: ["92117"],
  },
  "Point Loma": {
    metaTitle: "Concrete Contractor in Point Loma, San Diego | Rose Concrete",
    metaDescription:
      "Concrete contractor in Point Loma. Coastal hillside driveways, decorative patios, retaining walls. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in Point Loma",
    localContext:
      "Point Loma is the peninsula — ocean views, hillside lots, expensive real estate, and significant grade changes on most properties. Many Point Loma jobs combine concrete and engineering: a retaining wall to support a hillside driveway, a graded patio that drains away from the house, or a pool deck that has to handle the ocean-view sloping lot.\n\nCoastal location matters too — salt air drives our rebar coverage spec, so the work lasts.",
    whyHere:
      "Hillside lots, ocean-air durability, and the price-point of Point Loma homes mean shortcuts come back to bite. We pour properly the first time — proper rebar coverage, proper drainage, and finish work that matches the look of the home.",
    zipCodes: ["92106", "92107"],
  },
  "Coronado": {
    metaTitle: "Concrete Contractor in Coronado | Rose Concrete",
    metaDescription:
      "Concrete contractor in Coronado. Historic-home driveways, decorative patios, and pool decks. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in Coronado",
    localContext:
      "Coronado is a historic coastal community on the peninsula across from downtown San Diego — premium aesthetics, water-table considerations, and many homes with historic-overlay design rules. Most concrete work in Coronado leans decorative: stamped patios, exposed-aggregate pool decks, and driveways that match the architectural style of the home.\n\nThe water table is high in much of Coronado. Drainage planning matters more than on most mainland lots, and we always integrate drainage into the pour spec.",
    whyHere:
      "Coronado homeowners typically want the look and durability dialed in — we deliver both. Sample boards at the quote, finish work done in-house, and salt-air-spec rebar coverage so the work holds up.",
    zipCodes: ["92118"],
  },
  "Bonita": {
    metaTitle: "Concrete Contractor in Bonita | Rose Concrete",
    metaDescription:
      "Concrete contractor in Bonita. Larger-lot driveways, RV pads, equestrian property concrete. CA License #1130763. (619) 537-9408.",
    h1: "Concrete Contractor in Bonita",
    localContext:
      "Bonita is the Sweetwater Valley — semi-rural feel, larger lots than most of South County, and a strong equestrian community. Common Bonita concrete jobs include long driveways (sometimes 200+ feet to the house), RV/horse-trailer pads, barn floor slabs, and patios on properties with significant outdoor space.\n\nThe larger lots mean bigger pours, but they also mean better access for the truck — most Bonita pours are easier logistically than a tight central-city job.",
    whyHere:
      "Bonita's larger lots and equestrian-property needs are normal for our schedule. Long driveways, trailer pads, barn slabs — same crew, same warranty. We're South Bay regulars, in Bonita and Chula Vista most weeks.",
    zipCodes: ["91902"],
  },
};

/**
 * Build the full SERVICE_AREAS export by joining the brand list of cities
 * with the per-city content above. Pulls the slug from the same helper
 * the footer uses, so URLs stay consistent.
 */
export const SERVICE_AREA_PAGES: readonly ServiceArea[] = SERVICE_AREAS.map(
  (city) => {
    const content = SERVICE_AREA_CONTENT[city];
    if (!content) {
      throw new Error(`Missing service-area content for "${city}"`);
    }
    return {
      city,
      slug: slug(city),
      ...content,
    };
  },
);

export function serviceAreaBySlug(s: string): ServiceArea | undefined {
  return SERVICE_AREA_PAGES.find((a) => a.slug === s);
}
