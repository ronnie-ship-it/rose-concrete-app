/**
 * Single source of truth for brand constants on the marketing site.
 * Header, footer, mobile call bar, lead form copy, and the LocalBusiness
 * schema all pull from here so they can't drift apart. If Ronnie ever
 * changes the published phone number, this is the only file to edit.
 */

export const BUSINESS_NAME = "Rose Concrete and Development";
export const SHORT_NAME = "Rose Concrete";
export const PHONE_E164 = "+16195379408";
export const PHONE_DISPLAY = "(619) 537-9408";
export const PHONE_TEL_HREF = `tel:${PHONE_E164}`;
// `?body=` prefills the SMS app on iOS / most Android dialers.
export const PHONE_SMS_HREF = `sms:${PHONE_E164}?body=Hi%20Ronnie%2C%20I%27m%20interested%20in%20a%20concrete%20quote%20for`;

export const EMAIL = "ronnie@sandiegoconcrete.ai";
export const EMAIL_HREF = `mailto:${EMAIL}`;

/**
 * Canonical Google "leave a review" destination.
 *
 * Source: copied directly from the Rose Concrete Google Business Profile
 * "Get more reviews" panel on 2026-04-19. This is the short link that
 * Google itself recommends — no Place-ID guesswork, no homemade
 * `?cid=...` constructions, no maps.google.com search URLs. Just the
 * exact short link Ronnie's panel shows.
 *
 * Single source of truth for every "leave a review" surface in the app:
 *   - Marketing footer + contact page
 *   - Schema.org LocalBusiness.sameAs (so Google connects the marketing
 *     site back to the GBP listing)
 *   - The /dashboard/settings/reviews form's default value
 *   - The /api/cron/review-requests cron's fallback when the
 *     feature-flag config doesn't override it
 *   - Any future Review Gate / 4-5 star redirect component
 *
 * If Ronnie ever changes the Google Business Profile (renames, new
 * listing, etc.), update this constant — every surface picks up the
 * change automatically.
 */
export const GOOGLE_REVIEW_URL = "https://g.page/r/CdOSm81RQCO_EBM/review";

export const LICENSE = "CA License #1130763";
export const TRUST_SIGNALS = [
  LICENSE,
  "Veteran-Owned",
  "Fully Insured",
  "In-House Crew",
  "4.9-Star Rated",
] as const;

export const SERVICE_AREAS = [
  "National City",
  "City Heights",
  "Solana Beach",
  "University City",
  "La Jolla",
  "La Mesa",
  "Chula Vista",
  "El Cajon",
  "North Park",
  "Clairemont",
  "Point Loma",
  "Coronado",
  "Bonita",
] as const;

/**
 * Top-level nav items shown in the marketing header on desktop.
 *
 * "Service Areas" intentionally lives in the footer only — keeps the
 * top nav scannable on mobile, and the /service-areas index + 13 city
 * pages stay live for SEO + direct-URL access.
 */
export const PRIMARY_NAV = [
  { label: "Services", href: "/services" },
  { label: "About", href: "/about-us" },
  { label: "Contact", href: "/contact" },
] as const;
