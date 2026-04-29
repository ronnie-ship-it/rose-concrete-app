/**
 * Single source of truth for the 7 core service pages.
 *
 * Used by:
 *   - app/(marketing)/page.tsx                  — home services grid
 *   - app/(marketing)/services/page.tsx         — services index
 *   - app/(marketing)/services/[slug]/page.tsx  — dynamic detail pages
 *   - app/sitemap.ts                            — generated routes
 *
 * Editing copy: every customer-visible string lives in this file. Pages
 * never hard-code service copy. Add a new service by appending an entry
 * here — the [slug] route + sitemap pick it up automatically.
 *
 * `serviceTypeForForm` pre-fills the LeadForm's project-type dropdown
 * when the form is embedded on a service page. Must be a value in
 * lib/service-types.ts SERVICE_TYPES.
 */

import type { ServiceType } from "@/lib/service-types";
import type { Faq } from "@/components/marketing/faq-section";
import type { ProcessStep } from "@/components/marketing/process-steps";

export type TypicalCost = {
  /** Headline — usually "What does a [service] cost?" */
  heading: string;
  /** Range sentence with $ figures. */
  rangeSentence: string;
  /** Example sentence applying the range to a typical project. */
  exampleSentence: string;
  /** Factors that affect cost. */
  factors: readonly string[];
};

export type Service = {
  /** URL slug — matches /services/<slug>. */
  slug: string;
  /** Display name. */
  name: string;
  /** Card / hero subhead. One sentence, benefit-led. */
  shortDescription: string;
  /** SEO meta description (~150-160 chars, ends with phone number). */
  metaDescription: string;
  /** H1 on the detail page. May differ from `name` for keyword targeting. */
  h1: string;
  /** Hero eyebrow text. */
  heroEyebrow: string;
  /** Hero subhead — 1-2 sentences, sets expectation + reassurance. */
  heroSub: string;
  /** Long-form intro paragraph(s) — split with `\n\n` for breaks. */
  intro: string;
  /** Bullet list — "What's included" check-mark items. */
  whatsIncluded: readonly string[];
  /** 3-5 numbered process steps. */
  process: readonly ProcessStep[];
  /** 3-4 sentences explaining why hire us specifically (vs the cheap guy). */
  whyUs: string;
  /** Honest cost ranges + factors that affect the price. Optional —
   *  new marketing pages can launch without pricing and fill it in
   *  later, since most consumers ask anyway. */
  typicalCost?: TypicalCost;
  /** 4-5 FAQs. */
  faqs: readonly Faq[];
  /** Pre-fills the LeadForm dropdown. */
  serviceTypeForForm: ServiceType;
  /**
   * Service-type values the "Recent work" gallery on this page should
   * filter by. Optional — when omitted, the gallery filters on the
   * single value `[serviceTypeForForm]`.
   *
   * Used for combined service pages where one slug covers multiple
   * enum values (e.g. `walkways-sidewalks` covers walkway + sidewalk +
   * safe_sidewalks_program). Without this, those pages would only
   * surface one of the three.
   */
  serviceTypesForGallery?: readonly ServiceType[];
};

// ─── Driveways ──────────────────────────────────────────────────────────
const driveways: Service = {
  slug: "driveways",
  name: "Driveways",
  shortDescription:
    "Tear-out and replace, extensions, and new aprons. Built for SUVs, RVs, and the next 30 years.",
  metaDescription:
    "San Diego concrete driveway contractor. Tear-out and replace, widening, and new aprons. Veteran-owned, in-house crew, CA License #1130763. Free quote: (619) 537-9408.",
  h1: "Concrete Driveways in San Diego",
  heroEyebrow: "Driveways · San Diego County",
  heroSub:
    "Cracked driveway, oil-stained slab, or just want a wider parking pad? We tear out the old, prep the base properly, and pour you a driveway built to last decades — not seasons.",
  intro:
    "Most failed driveways in San Diego didn't fail because of the concrete. They failed because the base wasn't prepped, the rebar was skipped, or the control joints were spaced wrong. We pour driveways that actually last because we don't cut those corners — and Ronnie is on every job himself.\n\nWhether you need a full tear-out and replace, an extension to fit a third car or RV, or a brand-new driveway on a new build, we handle the whole thing — demo, haul-off, base prep, forms, rebar, pour, finish, and cleanup.",
  whatsIncluded: [
    "Demo and haul-off of the existing slab",
    "Compacted base prep with proper drainage slope",
    "#3 rebar grid (or fiber-mesh on smaller pours)",
    "Saw-cut control joints to prevent random cracking",
    "Choice of finish: broom, smooth-trowel, or stamped",
    "Final cleanup and walk-through",
    "Workmanship warranty in writing",
  ],
  process: [
    {
      title: "Free on-site quote",
      body: "Ronnie measures, checks the base condition, and writes you a fixed-price quote — usually same-week.",
    },
    {
      title: "Demo and base prep",
      body: "Saw-cut the perimeter, break out the old slab, haul it off, then re-grade and compact the base.",
    },
    {
      title: "Forms, rebar, and pour",
      body: "Set forms to the right slope for water runoff, lay rebar, and pour fresh 3500-psi mix in a single day.",
    },
    {
      title: "Finish, cure, and walk-through",
      body: "Finish to your chosen texture and saw-cut control joints. Park on it inside a week.",
    },
  ],
  whyUs:
    "We're a small, in-house crew — Ronnie pours every driveway himself. That means no salesperson promising one thing while a sub does another. You get the same crew from quote to walk-through, and a real warranty backed by the same hands that did the work.",
  typicalCost: {
    heading: "What does a driveway replacement cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Stamped, stained, or exposed-aggregate finishes add to that baseline depending on pattern, color, and material spec.",
    exampleSentence:
      "Demo and haul-off, base re-grade or import, reinforcement spec, finish choice, drainage work, and access (narrow side yards add labor) each shape the final number. We give you a fixed-price written quote at the on-site walk so you see the math before you commit.",
    factors: [
      "Total square footage",
      "Demo and haul-off of the existing slab",
      "Base condition (does it need re-grading or import?)",
      "Reinforcement spec (rebar grid vs fiber-mesh)",
      "Finish choice (broom · smooth · swirled · stamped · stained)",
      "Apron tie-in to the public right-of-way (separate permit)",
      "Drainage scope (slope adjustments, surface drains)",
      "Access — narrow side yards add labor time",
    ],
  },
  faqs: [
    {
      q: "How long until I can park on my new driveway?",
      a: "You can walk on it in 24-48 hours. We recommend keeping vehicles off for 7 days so the concrete reaches enough strength to handle car weight without imprinting. Heavy vehicles (RVs, work trucks) — give it 14 days.",
    },
    {
      q: "Do I need a permit to replace my driveway?",
      a: "Replacing an existing driveway in the same footprint usually doesn't need a permit. Widening it, changing the apron at the curb, or building a brand-new driveway in a new location does. We pull the permit if needed and handle the inspection.",
    },
    {
      q: "Can you match the texture of my existing driveway or sidewalk?",
      a: "In most cases, yes — we offer broom, smooth-trowel, swirled, and stamped finishes. We can usually match the look closely enough that the new pour blends with the rest of your hardscape.",
    },
    {
      q: "What about my landscaping or irrigation?",
      a: "We'll walk the job with you before demo and flag anything we need to protect or move. If a sprinkler line runs under the slab we'll cap it cleanly so your landscaper can re-route after the pour.",
    },
    {
      q: "What's the warranty?",
      a: "All our flatwork carries a workmanship warranty in writing. Hairline cracking is normal in concrete (it's why we cut control joints), but structural failures or settling within the warranty window — we come back and fix it on our dime.",
    },
  ],
  serviceTypeForForm: "driveway",
};

// ─── Patios ─────────────────────────────────────────────────────────────
const patios: Service = {
  slug: "patios",
  name: "Patios",
  shortDescription:
    "Backyard hangouts, fire-pit pads, and outdoor kitchens. Stamped, broomed, or smooth — your call.",
  metaDescription:
    "Concrete patio contractor in San Diego. Stamped, broomed, smooth, or stained finishes. Veteran-owned. CA License #1130763. Free quote: (619) 537-9408.",
  h1: "Concrete Patios in San Diego",
  heroEyebrow: "Patios · San Diego County",
  heroSub:
    "Backyard upgrades that turn a forgotten dirt patch into the spot everyone wants to hang out. Stamped, broomed, smooth, or stained — pick the look, we'll pour it.",
  intro:
    "A patio is the most-used hardscape on most San Diego homes. It's where the BBQ lives, where kids run between the sprinkler and the back door, and where you'll spend most of your fall evenings. We pour patios that handle that life — slip-resistant where you need it, smooth where you don't, and graded so water runs away from the house instead of pooling at the slider.\n\nNew patio, patio extension, fire-pit pad, or outdoor-kitchen base — we handle the layout, the prep, the pour, and the finish. We'll also work around your existing landscaping and irrigation so the project doesn't blow up the rest of the yard.",
  whatsIncluded: [
    "Layout consultation and grade planning",
    "Demo of any existing slab if needed",
    "Compacted base with proper drainage away from the house",
    "Rebar grid or fiber-mesh reinforcement",
    "Choice of finish: broom, stamped, smooth, swirled, or stained",
    "Decorative scoring or borders if desired",
    "Saw-cut control joints",
  ],
  process: [
    {
      title: "Walk and design",
      body: "Ronnie walks the yard with you, talks dimensions, finishes, and how you'll use the space, then writes a fixed-price quote.",
    },
    {
      title: "Prep and forms",
      body: "Demo any existing slab, dig and compact the base, set forms to the right slope so water flows away from the house.",
    },
    {
      title: "Pour and finish",
      body: "Pour 3500-psi mix in a single day, then finish to your chosen texture before it sets.",
    },
    {
      title: "Cure",
      body: "Saw-cut control joints and let it cure 7 days before furniture, 14 days before heavy use.",
    },
  ],
  whyUs:
    "We do all the finishing in-house — which is the part that makes or breaks a stamped or stained patio. The same crew that grades and forms also pours and finishes, so the look you saw in the sample is the look you get on your slab.",
  typicalCost: {
    heading: "What does a concrete patio cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Stamped, stained, or exposed-aggregate finishes add to that baseline depending on pattern, color, and material spec.",
    exampleSentence:
      "Site prep (grass, pavers, demo), base import, reinforcement spec, finish choice, color, drainage planning, and any border or scoring detail each shape the final number. We give you a fixed-price written quote at the on-site walk so you see the math before you commit.",
    factors: [
      "Total square footage",
      "Site prep (grass removal, demo, base import)",
      "Reinforcement spec (rebar vs fiber-mesh)",
      "Finish choice (broom is base; stamped, stained, or exposed adds)",
      "Color choice (integral pigment, surface stain, or both)",
      "Drainage planning (slope, channel drains)",
      "Border or scoring details",
    ],
  },
  faqs: [
    {
      q: "Stamped or broomed — which is better?",
      a: "Broomed is the workhorse — slip-resistant, lower cost, classic look. Stamped looks like tile, slate, or wood-grain but costs more and the surface stain (if you choose surface stain over integral color) does fade over time. If the patio sits in full sun and you want a high-end look, stamped is great. If it's a workhorse for kids and pets, broomed is honest.",
    },
    {
      q: "How long does a new patio take from quote to done?",
      a: "Most patios are scheduled within 2 weeks of accepting the quote. The actual pour day is one day. Curing takes 7 days before furniture, 14 days before heavy use.",
    },
    {
      q: "Can you match my existing patio's look?",
      a: "Yes for finish texture (broom, smooth, etc). Color match on stained or stamped concrete is harder because old concrete has weathered — we'll get it close, but expect a visible seam. Most folks address that with a decorative score line where the old meets new.",
    },
    {
      q: "What about my drainage?",
      a: "We grade every patio with at least 1/4 inch per foot of slope away from your house. If your yard already has standing-water issues, we'll talk through french drains or a swale before we pour.",
    },
    {
      q: "Can I add a fire pit or outdoor kitchen later?",
      a: "Yes, but tell us during the quote — we'll thicken the slab and add extra rebar in those spots so the future weight doesn't crack the patio.",
    },
  ],
  serviceTypeForForm: "patio",
};

// ─── Walkways & Sidewalks ───────────────────────────────────────────────
const walkways: Service = {
  slug: "walkways-sidewalks",
  name: "Walkways & Sidewalks",
  shortDescription:
    "Front walks, side paths, and city-spec sidewalk repairs. Poured in a day, walkable the next.",
  metaDescription:
    "San Diego concrete walkway and sidewalk contractor. Front walks, side paths, and city-spec repairs. Safe Sidewalks Program. CA License #1130763. (619) 537-9408.",
  h1: "Concrete Walkways & Sidewalks in San Diego",
  heroEyebrow: "Walkways & sidewalks · San Diego County",
  heroSub:
    "From the curb to your front door, side-yard paths, and city-spec sidewalk repairs. Same in-house crew, in writing, with a warranty.",
  intro:
    "The walkway from the sidewalk to your front door is the first piece of hardscape every visitor walks across. A cracked, lifted, or dirty walkway tells them the rest of the house probably isn't loved either. We pour clean, level, slip-resistant walkways that fix that — and we handle city-spec sidewalk repairs at the curb, including the ones the city sent you a notice about.\n\nIf you got a Safe Sidewalks Program notice from the City of San Diego, we can help with the paperwork too — see our Safe Sidewalks Program page for the details.",
  whatsIncluded: [
    "Demo of cracked or lifted sections",
    "Compacted base with code-required width and depth",
    "Rebar or wire-mesh reinforcement",
    "Code-compliant slope for ADA accessibility",
    "Broom finish for grip in wet weather",
    "Saw-cut control joints to prevent random cracking",
    "Permit pulled and inspection scheduled if required",
    "Workmanship warranty in writing",
  ],
  process: [
    {
      title: "Walk and assess",
      body: "Ronnie walks the path with you, identifies what needs replacing vs repair, and writes a fixed-price quote.",
    },
    {
      title: "Demo and prep",
      body: "Saw-cut the perimeter, break out cracked sections, prep the base with proper compaction.",
    },
    {
      title: "Forms and pour",
      body: "Set forms to the right width, slope, and elevation. Pour fresh mix and finish with a broom for grip.",
    },
    {
      title: "Cure and inspection",
      body: "Saw-cut control joints, let it cure, schedule the city inspection if it's a permit job.",
    },
  ],
  whyUs:
    "We pour to the city's actual specs — width, slope, joint spacing, code-compliant ADA cross-slope — so when an inspector comes out, the work passes the first time. No re-do calls, no withheld payments, no slowdowns.",
  typicalCost: {
    heading: "What does a sidewalk or walkway cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Smaller pours (front walks, single-panel sidewalk repairs) tend to be less labor-efficient than larger jobs, so per-sqft pricing on small work is at the higher end of the range.",
    exampleSentence:
      "If your sidewalk is in the City of San Diego and you have a Safe Sidewalks Program notice, see our Safe Sidewalks page — that program has its own pricing structure ($3,500 minimum + surveyor fee, with a city contribution applied to your notice). Otherwise, this is straight private-pay sidewalk or walkway work.",
    factors: [
      "Linear feet of sidewalk being replaced",
      "Number of panels demoed vs spot-repaired",
      "Tree-root removal (if root-lift is the cause)",
      "City permit fees (right-of-way work)",
      "ADA cross-slope requirements",
      "Width to existing block standard",
      "Inspection scheduling",
      "Safe Sidewalks Program eligibility (City of San Diego addresses only — National City and other cities don't have this program)",
    ],
  },
  faqs: [
    {
      q: "Is my sidewalk the city's responsibility or mine?",
      a: "In San Diego, the homeowner is generally responsible for the sidewalk in front of their house. The city's Safe Sidewalks Program splits the cost on qualifying repairs — we have a page about that.",
    },
    {
      q: "Do I need a permit to replace a walkway?",
      a: "A walkway from your front porch to the sidewalk on your private property usually doesn't need a permit. The sidewalk in the public right-of-way usually does — we pull it.",
    },
    {
      q: "How wide does the sidewalk need to be?",
      a: "City of San Diego spec is typically 4 feet wide minimum for residential sidewalks, with a code-compliant cross-slope (no more than 2%). We pour to those specs unless your block has a different historical width.",
    },
    {
      q: "How long until I can walk on it?",
      a: "24 hours for foot traffic, 7 days before heavy carts/strollers, 14 days before full normal use.",
    },
    {
      q: "What about my mail carrier and trash service?",
      a: "We coordinate with you so service isn't disrupted on pour day. Most jobs are walkable the next morning.",
    },
  ],
  serviceTypeForForm: "sidewalk",
  // The walkways-sidewalks page covers three flavors of work — make
  // sure the gallery surfaces all three, not just `sidewalk`-tagged
  // projects. Walkway showcases and Safe Sidewalks Program work both
  // belong here.
  serviceTypesForGallery: ["walkway", "sidewalk", "safe_sidewalks_program"],
};

// ─── Decorative Concrete ────────────────────────────────────────────────
const decorative: Service = {
  slug: "decorative-concrete",
  name: "Decorative Concrete",
  shortDescription:
    "Stained, stamped, or scored finishes that look custom without the custom price.",
  metaDescription:
    "Decorative concrete contractor in San Diego. Stamped, stained, scored, and polished finishes for driveways, patios, and walkways. CA License #1130763. (619) 537-9408.",
  h1: "Decorative Concrete in San Diego",
  heroEyebrow: "Decorative · San Diego County",
  heroSub:
    "Stamped, stained, scored, and polished finishes that turn your driveway or patio into a feature. Same durability as standard concrete — way more curb appeal.",
  intro:
    "Decorative concrete is the cheapest way to get a high-end look on a hardscape budget. Stamped concrete can look like tile, slate, brick, or wood plank. Stained concrete can pull warm tones out of an existing slab. Scored concrete adds clean grid lines that make a plain patio look intentional.\n\nWe do all four — stamping, staining, scoring, and polishing — on driveways, patios, walkways, and pool decks. Tell us the look you're after; we'll show you samples and write you a quote.",
  whatsIncluded: [
    "Sample boards so you can see and feel the finish in person",
    "Color and pattern selection (stamping mats, stain colors, score patterns)",
    "Base prep and proper drainage slope",
    "Pour with integral color or post-pour stain",
    "Stamp or score work while the slab is still workable",
    "Maintenance instructions for the long haul",
    "Workmanship warranty in writing",
  ],
  process: [
    {
      title: "Pick your finish",
      body: "Browse stamps, stains, and patterns. Ronnie brings sample boards to the quote so you see the actual finish on actual concrete.",
    },
    {
      title: "Prep and pour",
      body: "Same prep as a standard pour — base, forms, rebar — then pour with integral color if you chose that route.",
    },
    {
      title: "Stamp or score",
      body: "While the slab is still workable, we apply the stamping mats or cut the score lines you picked.",
    },
    {
      title: "Stain (optional)",
      body: "If you chose a surface stain on top of integral color, we apply it after the slab cures.",
    },
  ],
  whyUs:
    "Stamped and stained finishes are where bad crews get exposed. The pattern bleeds, the color washes out. We do all the finishing in-house — same hands that pour, stamp, and stain — so you get the look you signed up for.",
  // Migration 029 added decorative_concrete enum value — cleanly typed now.
  typicalCost: {
    heading: "What does decorative concrete cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Decorative finishes — stamped, stained, scored, or polished — add to that baseline depending on pattern complexity, color depth, and any accent work.",
    exampleSentence:
      "A single-stamp slate pattern in a single integral color is at the lower end of the decorative range. Multi-stamp ashlar with surface stain on top of integral color and accent score-line borders is at the top. We give you a fixed-price written quote at the on-site walk so you see the math before you commit.",
    factors: [
      "Base concrete cost (square footage × thickness)",
      "Pattern complexity (single-stamp is base; multi-stamp ashlar adds)",
      "Color depth (integral pigment is base; surface stain adds)",
      "Border or accent score lines",
      "Whether overlay on existing slab is possible",
      "Decorative scoring or saw-cut detail work",
    ],
  },
  faqs: [
    {
      q: "Stamped vs stained — what's the difference?",
      a: "Stamped concrete uses textured mats pressed into wet concrete to create a 3D pattern (slate, wood plank, tile). Stained concrete uses chemical or acrylic stains to add color to a flat surface. They're often combined — stamp the texture, then stain the color.",
    },
    {
      q: "How long does the color last?",
      a: "Integral color (mixed into the concrete) lasts the lifetime of the slab. Surface stain depends on the stain type and sun exposure — figure 5–7 years before a refresh on a high-sun patio.",
    },
    {
      q: "Can decorative concrete go on top of my existing patio?",
      a: "Sometimes — with a concrete overlay. The existing slab has to be structurally sound (no major cracks, no settling). We'll evaluate during the quote.",
    },
    {
      q: "Does it need special maintenance?",
      a: "A light pressure-wash once a year is the main upkeep. We'll send you maintenance instructions specific to your finish.",
    },
    {
      q: "Is it slippery when wet?",
      a: "Smooth and polished finishes can be — that's why we don't recommend them for pool decks or patios where bare feet meet water. Stamped and broomed finishes have natural texture that's slip-resistant even wet.",
    },
  ],
  serviceTypeForForm: "decorative_concrete",
};

// ─── Exposed Aggregate ──────────────────────────────────────────────────
const exposed: Service = {
  slug: "exposed-aggregate",
  name: "Exposed Aggregate",
  shortDescription:
    "Pebble-finish surfaces with serious grip and a high-end look — perfect for slopes and pool decks.",
  metaDescription:
    "Exposed aggregate concrete in San Diego. Slip-resistant pebble finish for driveways, walkways, and pool decks. CA License #1130763. (619) 537-9408.",
  h1: "Exposed Aggregate Concrete in San Diego",
  heroEyebrow: "Exposed aggregate · San Diego County",
  heroSub:
    "Pebble-finish concrete with natural slip resistance and a high-end look. The right call for sloped driveways, pool decks, and any wet surface where grip matters.",
  intro:
    "Exposed aggregate is a finish, not a different concrete — we pour standard concrete with decorative aggregate (pebbles, river rock, glass) seeded into the top, then wash away the surface paste so the stones show. The result: a textured, slip-resistant surface that looks like a hand-laid pebble walk and lasts as long as the slab itself.\n\nIt's the right call for sloped driveways (where smooth concrete becomes a slide in the rain), for pool decks (where bare feet need grip), and for any walkway that gets wet often.",
  whatsIncluded: [
    "Choice of aggregate type and color (gray, tan, river-rock, custom)",
    "Sample boards at the quote",
    "Base prep and forms to standard concrete spec",
    "Pour with seeded aggregate at the surface",
    "Wash technique to expose the right amount of stone",
    "Maintenance instructions",
    "Workmanship warranty",
  ],
  process: [
    {
      title: "Pick your aggregate",
      body: "Choose stone size and color from sample boards. Ronnie quotes a fixed price including the aggregate.",
    },
    {
      title: "Prep and pour",
      body: "Standard base prep, forms, and pour — same quality as any other slab.",
    },
    {
      title: "Seed and finish",
      body: "Aggregate is broadcast onto the surface and pressed into the wet concrete with a roller.",
    },
    {
      title: "Wash",
      body: "Time it right — wash off the surface paste at the right moment to expose the stones cleanly.",
    },
  ],
  whyUs:
    "The wash window for exposed aggregate is short — too early and the stones come loose, too late and you can't get the cement off. We've poured enough of these to know the timing for San Diego's weather, so the finish comes out tight and even.",
  faqs: [
    {
      q: "Is exposed aggregate harder to keep clean?",
      a: "A bit — debris and dirt can sit between the stones. Pressure-washing once a year handles it. The trade-off is well worth it for the grip and the look.",
    },
    {
      q: "How slip-resistant is it?",
      a: "Significantly more than smooth or even broomed concrete. The texture comes from real stones, so even with a layer of water on top, your feet have something to grip.",
    },
    {
      q: "Can I match an existing exposed-aggregate driveway?",
      a: "Aggregate type and color — yes, if we can identify the original stones. Sun-aging will leave a visible seam between old and new for a year or two until the new section weathers in.",
    },
    {
      q: "Is it more expensive than broomed concrete?",
      a: "A bit — the aggregate adds material cost and the wash step adds labor. Worth it on slopes and around pools where slip resistance matters.",
    },
  ],
  serviceTypeForForm: "exposed_aggregate",
};

// ─── Paving ─────────────────────────────────────────────────────────────
const paving: Service = {
  slug: "paving",
  name: "Paving",
  shortDescription:
    "Driveway aprons, paths, and small parking pads. Graded, prepped, and finished for water and weight.",
  metaDescription:
    "Concrete paving in San Diego. Driveway aprons, walking paths, and parking pads. Veteran-owned, in-house crew. CA License #1130763. (619) 537-9408.",
  h1: "Concrete Paving in San Diego",
  heroEyebrow: "Paving · San Diego County",
  heroSub:
    "Smaller flatwork — driveway aprons, walking paths, RV parking pads. Same prep, same crew, same warranty as a full driveway pour.",
  intro:
    "Paving is the work in between the big jobs — the driveway apron at the curb, the walking path from the back gate to the trash bins, the parking pad for the boat trailer next to the garage. Smaller projects, but the prep matters just as much: skip the base compaction or the rebar and you've poured a slab that'll crack in two winters.\n\nWe handle these projects with the same crew, the same prep, and the same finish quality as a full driveway. They get the same warranty too.",
  whatsIncluded: [
    "Site survey and grade planning",
    "Demo of any existing surface",
    "Compacted base with drainage slope",
    "Rebar or fiber-mesh reinforcement",
    "Choice of finish (broom, smooth, exposed aggregate)",
    "Saw-cut control joints",
    "Permit pulled if working in the right-of-way",
    "Workmanship warranty",
  ],
  process: [
    {
      title: "Walk and quote",
      body: "Ronnie measures the area, checks the grade, and writes a fixed-price quote.",
    },
    {
      title: "Prep",
      body: "Demo, dig, compact base, set forms to the right elevation and slope.",
    },
    {
      title: "Pour and finish",
      body: "Pour 3500-psi mix, finish to your chosen texture before it sets.",
    },
    {
      title: "Cure",
      body: "Saw-cut control joints, let it cure for 7 days before regular traffic.",
    },
  ],
  whyUs:
    "Small paving jobs are where most contractors cut corners — skip the rebar, thin the slab, rush the cure. We don't, because the warranty has our name on it. Same crew, same standards, every pour.",
  typicalCost: {
    heading: "What does concrete paving cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Smaller pours (under ~400 sq ft) tend to be less labor-efficient than driveway-sized jobs, so per-sqft pricing on small work is at the higher end.",
    exampleSentence:
      "Slab thickness (4-inch standard, 6-inch for heavy loads), demo of the existing surface, base import if needed, permits if working in the right-of-way, and finish choice each shape the final number.",
    factors: [
      "Square footage (smaller = higher per-sqft)",
      "Slab thickness (4-inch standard, 6-inch for heavy loads)",
      "Demo of existing surface (grass, pavers, gravel)",
      "Base import (poor existing soil)",
      "Permit if work is in the right-of-way",
      "Finish (broom is base; exposed aggregate adds)",
    ],
  },
  faqs: [
    {
      q: "What's the difference between paving and a driveway?",
      a: "Paving is a category that includes driveways, walkways, paths, parking pads, aprons, and any flat exterior concrete. We use 'paving' on this page for the smaller jobs — under ~400 sq ft — that aren't full driveway replacements.",
    },
    {
      q: "Will it handle my RV / boat trailer?",
      a: "If you tell us the weight up front, we'll thicken the slab (typically 6 inches instead of 4) and add extra rebar. A pad designed for an RV won't crack under the weight even after years.",
    },
    {
      q: "Concrete vs asphalt for a parking pad — which is better?",
      a: "Concrete lasts 2-3x longer in San Diego sun, doesn't soften in heat, and looks better. Asphalt is cheaper up front. For a residential pad you'll keep for the long haul, concrete wins.",
    },
    {
      q: "Do I need a permit to replace my driveway apron?",
      a: "Yes — the apron is in the public right-of-way. We pull the encroachment permit and handle the city inspection.",
    },
    {
      q: "How long until I can use it?",
      a: "Foot traffic in 24 hours, vehicles in 7 days, heavy vehicles in 14 days.",
    },
  ],
  serviceTypeForForm: "paving",
};

// ─── Retaining Walls ────────────────────────────────────────────────────
const retainingWalls: Service = {
  slug: "retaining-walls",
  name: "Retaining Walls",
  shortDescription:
    "Engineered concrete walls that hold soil, level grade, and survive San Diego rainstorms.",
  metaDescription:
    "Concrete retaining wall contractor in San Diego. Engineered for hillside lots, drainage included. CA License #1130763. Free quote: (619) 537-9408.",
  h1: "Concrete Retaining Walls in San Diego",
  heroEyebrow: "Retaining walls · San Diego County",
  heroSub:
    "Hillside lots, sloped backyards, and grade changes that need a real wall — not stacked block. Engineered, drained, and built to outlast the house.",
  intro:
    "A retaining wall has one job: hold back tons of saturated soil during a winter storm without bulging, leaning, or failing. Done right, it's a 50-year wall. Done wrong, it'll start tipping the first wet season and become someone else's problem.\n\nWe build engineered concrete retaining walls — proper footings, vertical rebar, drainage system behind the wall, and weep holes where they need to be. For walls over 4 feet (or any wall holding a sloped surcharge), we work with a licensed engineer for the design.",
  whatsIncluded: [
    "Site survey and engineering coordination if needed",
    "Permit pulled if wall exceeds height threshold",
    "Excavation and footing prep",
    "Continuous rebar grid (vertical + horizontal)",
    "French drain and gravel backfill behind the wall",
    "Weep holes for water relief",
    "Choice of finish: smooth, board-form, stained, or veneer-ready",
    "Workmanship warranty in writing",
  ],
  process: [
    {
      title: "Survey and design",
      body: "Ronnie walks the site, measures the grade, and pulls in an engineer if the wall needs one.",
    },
    {
      title: "Permit and prep",
      body: "Permits pulled, locate calls submitted, then excavation and footing forms set.",
    },
    {
      title: "Rebar and pour",
      body: "Continuous vertical and horizontal rebar tied, forms set, concrete poured in a single lift if possible.",
    },
    {
      title: "Drainage and backfill",
      body: "French drain installed behind the wall, gravel backfill placed, then native soil compacted on top.",
    },
  ],
  whyUs:
    "Most retaining-wall failures come from skipped drainage. We never skip it. Every wall gets a french drain behind it and weep holes through it — that's what keeps water from building hydrostatic pressure and pushing the wall over.",
  typicalCost: {
    heading: "What does a concrete retaining wall cost?",
    rangeSentence:
      "Concrete retaining walls run $50–$120 per linear foot of wall, scaling with height and engineering needs. Walls over 4 feet (or with sloped soil above) need an engineer and add design cost.",
    exampleSentence:
      "A typical 30-linear-foot wall at 3 feet tall lands between $1,800 and $2,700. A 30-linear-foot engineered wall at 6 feet tall runs $4,500–$7,500 including drainage.",
    factors: [
      "Wall height (drives engineering + footing depth)",
      "Linear footage",
      "Whether engineering is required (height + surcharge)",
      "Drainage system (french drain + weep holes — never skip)",
      "Excavation depth and access",
      "Finish (smooth, board-form, veneer-ready)",
      "Permit fees if applicable",
    ],
  },
  faqs: [
    {
      q: "How tall can a wall be without a permit?",
      a: "City of San Diego: typically 3 feet exposed height without a permit, as long as there's no surcharge (sloped soil) above it. Anything taller or with a surcharge needs a permit and engineered design — we handle both.",
    },
    {
      q: "How long do concrete retaining walls last?",
      a: "Built right — engineered, drained, properly reinforced — 50+ years. We've fixed walls poured in the 1960s that failed because they had no drainage. Drainage is what kills them, not the concrete.",
    },
    {
      q: "Can the wall double as a planter or a seat?",
      a: "Yes — we can design a thicker top for seating, or build a planter box on top with weep holes so it drains properly without rotting the wall.",
    },
    {
      q: "Will the wall match my house?",
      a: "Smooth, board-form (looks like wood-grain), or veneer-ready (we leave it smooth so you can apply stone or stucco veneer) — your call. We'll match your house's look during the quote.",
    },
    {
      q: "What about my neighbor's property?",
      a: "We'll need to know exactly where the property line is (we'll pull the survey or coordinate with your neighbor) and whether the wall is fully on your property or shared. Most walls go fully on the high-side property to keep things clean.",
    },
  ],
  serviceTypeForForm: "retaining_wall",
};

// ─── Export ─────────────────────────────────────────────────────────────

export const CORE_SERVICES: readonly Service[] = [
  driveways,
  patios,
  walkways,
  decorative,
  exposed,
  paving,
  retainingWalls,
] as const;

/** Lookup helper. */
export function serviceBySlug(slug: string): Service | undefined {
  return CORE_SERVICES.find((s) => s.slug === slug);
}

/** Up-to-3 related services for the bottom-of-page cross-link block. */
export function relatedServices(slug: string): readonly Service[] {
  return CORE_SERVICES.filter((s) => s.slug !== slug).slice(0, 3);
}
