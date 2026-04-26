# URL migration plan — old Duda site → new Next.js site

> **Status — 2026-04-25.** Pre-deploy decisions from Ronnie applied:
> foundations OUT (off-menu), bollards IN (no page yet — flagged),
> pickleball IN (no page yet — flagged), Encinitas/Del Mar/Carlsbad
> OUT of service area, La Jolla added as a 13th service area. Redirects
> in `next.config.mjs` updated to match.

**Stakes:** 116k Google Search impressions / 618 clicks per quarter on
the old Duda site. Top query is "concrete contractors san diego" (the
high-intent gold one). Losing those rankings during the deploy = real
lost business. Every old URL needs to either resolve cleanly on the
new site OR redirect (308 permanent) to the closest semantic match.

**Source:** `Rose Concrete/duda-site-content/SITEMAP_URLS.txt`
(71 old URLs, captured pre-deploy via Cowork backup).

**Implementation:** All redirects defined in `next.config.mjs`'s async
`redirects()` function. They fire BEFORE Next.js middleware (per Next's
documented evaluation order: redirects → middleware → routes), so
old paths short-circuit cleanly before the host-routing middleware
gets a chance to bounce them to `app.*`.

All redirects are **`permanent: true` (HTTP 308)** so Google transfers
link equity from the old URL to the new one.

---

## Bucket 1 — 1:1 paths (no redirect needed; same path on new site)

| Old URL | Status |
|---|---|
| `/` | ✅ Resolves — new home page |
| `/about-us` | ✅ Resolves — `app/(marketing)/about-us/page.tsx` |
| `/contact` | ✅ Resolves — `app/(marketing)/contact/page.tsx` |
| `/services/decorative-concrete` | ✅ Resolves — exact slug match |
| `/services/retaining-walls` | ✅ Resolves — exact slug match |

**5 URLs preserved as-is.**

---

## Bucket 2 — Service detail redirects (specific service pages)

The old Duda site used different slugs for the same concepts. Each
redirects to the canonical new-site equivalent.

| Old URL | → New URL | Reason |
|---|---|---|
| `/services/concrete-driveway` | `/services/driveways` | Slug rename |
| `/services/concrete-patio` | `/services/patios` | Slug rename |
| `/services/concrete-paving` | `/services/paving` | Slug rename |
| `/services/concrete-paving/concrete-walkways` | `/services/walkways-sidewalks` | Reorganized |
| `/services/exposed-aggregate-concrete` | `/services/exposed-aggregate` | Slug rename |
| `/services/decorative-concrete/stamped` | `/landing/stamped-concrete-patios-san-diego` | Promoted to landing page |
| `/services/safe-sidewalks-program` | `/landing/safe-sidewalks-program-san-diego` | Promoted to landing page |
| `/services/rv-pads` | `/landing/rv-pads-san-diego` | Promoted to landing page |
| `/services/concrete-repair` | `/landing/sidewalk-repair-san-diego` | Closest topical match |
| `/services/concrete-slabs` | `/services/paving` | "Slabs" = flatwork in new taxonomy |

**10 redirects.**

---

## Bucket 3 — Off-menu service pages

Decisions confirmed 2026-04-25:

- **Foundations: OUT.** Rose Concrete is no longer doing foundation
  work going forward. All foundation variants now redirect to
  `/services` (the overview), not to a "next-best foundation page."
  - The DB enum value `foundation` stays so historical lead rows still
    type-check, but the marketing form dropdown hides it via
    `EXCLUDED_FROM_MARKETING_FORM` in `lib/service-types.ts`.
  - No internal links anywhere on the new marketing site point to a
    foundation page (verified via grep — only `services/retaining-walls`
    mentions `proper footings` for retaining-wall context, which is
    correct).
- **Bollards: IN** as a real service, but **no dedicated `/services/bollards`
  page exists on the new site yet.** Old bollard URLs currently redirect
  to `/landing/commercial-flatwork-san-diego` as the closest match.
  ⚠️ **Flagged:** create a `bollards` entry in `lib/marketing/services.ts`
  + add `bollard` to the `service_type` enum (migration) so the form
  dropdown can offer it. Then update the redirects to point at the new
  page.
- **Pickleball: IN** as a real service, but same situation — **no
  `/services/pickleball-courts` page on the new site.** Old pickleball
  URLs currently redirect to `/services`. The enum already has
  `pickleball_court` so the form CAN accept it; just no dedicated
  marketing page yet. ⚠️ **Flagged:** add a `pickleball-courts`
  service-page entry in `lib/marketing/services.ts`.
- **Airport hangars: still OUT** (niche commercial, no demand).

| Old URL | → New URL | Reason |
|---|---|---|
| `/services/concrete-bollards` | `/landing/commercial-flatwork-san-diego` | ⚠️ Bollards IN — temporary best-fit until a dedicated page exists |
| `/services/concrete-footings` | `/services/retaining-walls` | Wall footings still offered (retaining-wall context) |
| `/services/concrete-foundations` | `/services` | OUT — overview |
| `/services/crawl-space-foundation` | `/services` | OUT |
| `/services/slab-foundation` | `/services` | OUT (changed from `/services/paving`) |
| `/services/pickleball-courts` | `/services` | ⚠️ Pickleball IN — temporary best-fit until dedicated page exists |
| `/services/airport-hangars` | `/services` | Off-menu — niche commercial |

**7 redirects.** No further confirmation needed on this bucket.

### ⚠️ Pages to create when there's time

- `/services/bollards` — content entry in `lib/marketing/services.ts`,
  add `bollard` to the `service_type` enum via a new migration, point
  the bollard redirects at it. Probably also worth a
  `/landing/concrete-bollards-san-diego` for the high-intent commercial
  search ("do I need a bollard for my business").
- `/services/pickleball-courts` — content entry in
  `lib/marketing/services.ts`. The `pickleball_court` enum value
  already exists. Point the pickleball redirects at it.

---

## Bucket 4 — City-scoped service pages

Old Duda site combined service + city (`/services/coronado--ca`). New
site has a single page per service area. Decisions confirmed 2026-04-25:

- **La Jolla: ADDED as a 13th service area.** Now lives at
  `/service-areas/la-jolla` with content in `lib/marketing/service-areas.ts`.
  Old `/services/la-jolla--ca` redirects to the new page (clean SEO transfer).
- **Encinitas, Del Mar, Carlsbad: OUT of service area.** Too far north,
  traffic eats margins. Old URLs redirect to `/service-areas/solana-beach`
  (the northernmost city we still serve) so the SEO equity transfers
  to the closest in-scope page rather than the generic index.
- All remaining out-of-scope cities (Lincoln Acres, Little Italy,
  Rancho Santa Fe, Carmel Valley, Torrey Hills, Poway, Hillcrest)
  still redirect to `/service-areas` index.

### City matches (city now in our 13)

| Old URL | → New URL |
|---|---|
| `/concrete-contractor-bonita-ca` | `/service-areas/bonita` |
| `/concrete-contractors-chula-vista-ca` | `/service-areas/chula-vista` |
| `/services/clairemont-mesa--ca` | `/service-areas/clairemont` |
| `/services/coronado--ca` | `/service-areas/coronado` |
| `/services/la-jolla--ca` | `/service-areas/la-jolla` ⭐ NEW |
| `/services/north-park--ca` | `/service-areas/north-park` |
| `/services/solana-beach` | `/service-areas/solana-beach` |
| `/services/university-city` | `/service-areas/university-city` |

### Far-north-county redirects (out of scope; routed to closest in-scope)

| Old URL | → New URL | Reason |
|---|---|---|
| `/services/encinitas` | `/service-areas/solana-beach` | Closest in-scope, north |
| `/services/del-mar` | `/service-areas/solana-beach` | Closest in-scope, north |
| `/services/carlsbad--ca` | `/service-areas/solana-beach` | Closest in-scope, north |

### Service-not-area redirects (city + service combo, city out of scope)

| Old URL | → New URL |
|---|---|
| `/concrete-driveway/serra-mesa-ca` | `/services/driveways` |
| `/concrete-patio/bankers-hill-ca` | `/services/patios` |

### Cities not in scope, no good closest match

| Old URL | → New URL |
|---|---|
| `/lincoln-acres--ca` | `/service-areas` |
| `/services/little-italy-ca` | `/service-areas` |
| `/services/rancho-santa-fe` | `/service-areas` |
| `/services/carmel-valley` | `/service-areas` |
| `/services/torrey-hills--ca` | `/service-areas` |
| `/services/poway--ca` | `/service-areas` |
| `/services/hillcrest--ca` | `/service-areas` |

**20 redirects.** No further confirmation needed.

---

## Bucket 5 — Old `/service-areas/concrete-contractor-*` pattern

Old Duda site nested service-area pages under
`/service-areas/concrete-contractor-<city>-...`. New site uses a
cleaner `/service-areas/<city>` slug.

| Old URL | → New URL |
|---|---|
| `/service-areas/concrete-contractor-city-heights-san-diego` | `/service-areas/city-heights` |
| `/service-areas/concrete-contractor-national-city-ca` | `/service-areas/national-city` |

| Old URL (city not in our 12) | → New URL |
|---|---|
| `/service-areas/concrete-contractor-lemon-grove-ca` | `/service-areas` |
| `/service-areas/concrete-contractor-logan-heights-san-diego` | `/service-areas` |
| `/service-areas/concrete-contractor-mid-city-san-diego` | `/service-areas` |
| `/service-areas/concrete-contractor-encanto-san-diego` | `/service-areas` |
| `/service-areas/concrete-contractor-south-park-san-diego` | `/service-areas` |
| `/service-areas/concrete-contractor-golden-hill-san-diego` | `/service-areas` |
| `/service-areas/kensington-ca-concrete-contractor` | `/service-areas` |
| `/service-areas/concrete-contractor-paradise-hills-san-diego` | `/service-areas` |
| `/service-areas/concrete-contractor-mission-valley-ca` | `/service-areas` |

**11 redirects.**

---

## Bucket 6 — Blog / question-pages

Old Duda site had "answer" pages built around long-tail queries. New
site doesn't have a blog. Each old article redirects to the most
topically relevant landing or service page so the SEO equity follows.

| Old URL | → New URL |
|---|---|
| `/blog` | `/` |
| `/signs-of-a-settling-concrete-slab` | `/services` |
| `/planning-pickleball-court-construction-for-year-round-play` | `/services` |
| `/decorative-concrete-style-and-strength-for-your-property` | `/services/decorative-concrete` |
| `/do-i-need-a-concrete-bollard-for-my-san-diego-business` | `/landing/commercial-flatwork-san-diego` |
| `/top-rated-concrete-contractor-san-diego` | `/` |
| `/who-provides-reliable-commercial-parking-lot-paving-in-san-diego` | `/landing/commercial-flatwork-san-diego` |
| `/who-handles-sidewalk-repairs-in-san-diego-under-the-safe-sidewalks-program` | `/landing/safe-sidewalks-program-san-diego` |
| `/who-builds-long-lasting-concrete-patios-in-san-diego` | `/services/patios` |
| `/who-handles-reliable-sidewalk-repairs-in-san-diego` | `/landing/sidewalk-repair-san-diego` |
| `/who-offers-quality-and-value-for-stamped-concrete-projects-in-san-diego` | `/landing/stamped-concrete-patios-san-diego` |
| `/which-concrete-contractor-in-san-diego-shows-up-on-time-and-keeps-your-property-clean` | `/` |
| `/who-is-the-top-rated-concrete-contractor-in-san-diego-for-driveway-replacements-and-paving` | `/landing/driveway-replacement-san-diego` |
| `/which-concrete-contractor-in-san-diego-handles-sidewalk-drainage-and-cleaning-the-right-way` | `/landing/concrete-drainage-solutions-san-diego` |
| `/who-is-the-best-concrete-contractor-in-san-diego-for-safe-sidewalks-program-repairs` | `/landing/safe-sidewalks-program-san-diego` |
| `/top-concrete-foundation-contractor-in-san-diego-free-estimates` | `/` |

**16 redirects.**

---

## Bucket 7 — Misc utility pages

| Old URL | → New URL | Reason |
|---|---|---|
| `/thank-you` | `/` | New form has an inline success state — no separate page |
| `/recommend-businesses` | `/` | Page being dropped entirely |

**2 redirects.**

---

## Tally

| Bucket | Count | Action |
|---|---|---|
| 1:1 (no action) | 5 | Resolve naturally |
| Service detail redirects | 10 | 308 redirect |
| Off-menu services | 7 | 308 redirect (⚠️ confirm off-menu) |
| City-scoped service pages | 20 | 308 redirect |
| Old `/service-areas/concrete-contractor-*` | 11 | 308 redirect |
| Blog / question-pages | 16 | 308 redirect |
| Misc | 2 | 308 redirect |
| **Total** | **71** | **66 redirects + 5 native resolves** |

Every old URL is accounted for.

---

## ⚠️ Items needing Ronnie's eyeball before deploy

All major decisions resolved 2026-04-25. Two follow-up items remain
that don't block the deploy but should land soon:

1. **Bollards needs a dedicated service page.** Bollards is IN as a
   service but `/services/bollards` doesn't exist yet — old URLs
   currently redirect to `/landing/commercial-flatwork-san-diego` as
   the closest match. To fix: add a `bollards` entry in
   `lib/marketing/services.ts`, add `bollard` to the service_type enum
   via a new migration, then update the redirect in `next.config.mjs`.
2. **Pickleball needs a dedicated service page.** Same shape as
   bollards. The `pickleball_court` enum value already exists; just
   need the marketing-page entry. Update the redirect once it lands.
3. **Top-ranking page check:** Search Console showed
   `/top-rated-concrete-contractor-san-diego` as one of the
   high-impression URLs. It currently redirects to `/` (the new home
   page). The new home meta title contains "San Diego Concrete
   Contractor" so the rank should follow — but worth watching GSC for
   the first 2 weeks post-deploy to confirm.

---

## Post-deploy verification (do this within 48h of going live)

1. `curl -I https://www.sandiegoconcrete.ai/services/concrete-driveway`
   → expect `HTTP/1.1 308` with `Location: /services/driveways`.
   Spot-check ~5 random old URLs.
2. Submit the new sitemap.xml to Search Console.
3. Watch GSC's "Coverage" report for unexpected 404s.
4. Watch GSC's "Performance" report — if any of the top-ranking URLs
   drop more than 20% in clicks within 2 weeks, the redirect for that
   URL is sending Google to the wrong destination. Adjust + redeploy.
