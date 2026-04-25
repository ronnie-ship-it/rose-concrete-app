/**
 * Single source of truth for the 10 high-intent landing pages.
 *
 * Each page targets a specific Google Ads + SEO keyword and is built for
 * conversion — form above the fold in the hero, problem-focused H1,
 * concrete (no-price) cost context, FAQ.
 *
 * Used by:
 *   - app/(marketing)/landing/[slug]/page.tsx  — dynamic detail pages
 *   - app/sitemap.ts                           — generated routes
 *   - app/(marketing)/page.tsx                 — featured-programs callout
 *
 * Editing copy: every customer-visible string lives here. Pages never
 * hard-code landing copy. Add a new landing page by appending an entry.
 *
 * Safe Sidewalks Program is intentionally the longest entry — it's the
 * flagship lead-gen page and explains the City of San Diego's program
 * end-to-end so a panicked homeowner can land on it from a Google search
 * for "safe sidewalks program san diego" and immediately understand
 * what's going on, what it costs them, and what to do next.
 */

import type { ServiceType } from "@/lib/service-types";
import type { Faq } from "@/components/marketing/faq-section";
import type { ProcessStep } from "@/components/marketing/process-steps";
import type { TypicalCost } from "@/lib/marketing/services";

export type LandingTimelineRow = {
  phase: string;
  duration: string;
  note: string;
};

export type LandingPage = {
  /** URL slug — matches /landing/<slug>. */
  slug: string;
  /** Display name (used in breadcrumb + sitemap). */
  name: string;
  /** Category label (used in breadcrumb second segment + meta keywords). */
  category: string;
  /** SEO meta title. */
  metaTitle: string;
  /** SEO meta description. */
  metaDescription: string;
  /** Hero eyebrow text. */
  heroEyebrow: string;
  /** H1 — problem-focused, not service-focused. */
  h1: string;
  /** Hero subhead — 2-3 sentences, names the problem + the path forward. */
  heroSub: string;
  /** Long-form intro paragraphs (split with `\n\n`). */
  intro: string;
  /** Bullet list — "What you get" check-mark items. */
  whatYouGet: readonly string[];
  /** 3-4 numbered process steps. */
  process: readonly ProcessStep[];
  /** Phase-by-phase timeline. */
  timeline: readonly LandingTimelineRow[];
  /** "What affects cost" paragraph — variables, not prices. */
  costContext: string;
  /** Honest cost ranges + factors. Optional — pages without typicalCost
   *  fall back to rendering just the costContext paragraph. */
  typicalCost?: TypicalCost;
  /** Optional emphasized callout (eligibility, special programs, etc). */
  callout?: { title: string; body: string };
  /** FAQs — 5-8 typically; safe-sidewalks gets 12+. */
  faqs: readonly Faq[];
  /** Pre-fills the LeadForm dropdown. */
  serviceTypeForForm: ServiceType;
  /** Bottom-of-page related links. */
  related?: readonly { title: string; href: string; sub?: string }[];
};

// ─── 1. Safe Sidewalks Program (FLAGSHIP) ───────────────────────────────
const safeSidewalks: LandingPage = {
  slug: "safe-sidewalks-program-san-diego",
  name: "Safe Sidewalks Program",
  category: "Sidewalks",
  metaTitle:
    "Safe Sidewalks Program San Diego — Contractor Help | Rose Concrete",
  metaDescription:
    "Got a Safe Sidewalks Program notice? Rose Concrete handles the demo, forms, pour, and city inspection. Veteran-owned, CA License #1130763. Free assessment: (619) 537-9408.",
  heroEyebrow: "Safe Sidewalks Program · San Diego",
  h1: "Got a Safe Sidewalks notice? We handle it end-to-end.",
  heroSub:
    "The City of San Diego's Safe Sidewalks Program splits the cost of qualifying sidewalk repairs with the homeowner. We handle the demo, forms, pour, inspection, and paperwork — so you fix the sidewalk without becoming a part-time city contractor.",
  intro:
    "If you got a Safe Sidewalks Program notice from the City of San Diego, take a breath. The notice means the inspector flagged a section of sidewalk in front of your house as a trip hazard or in poor condition — but it does NOT mean you have to pay for the whole repair, and it does NOT mean you have to figure the process out alone.\n\nThe Safe Sidewalks Program is the city's cost-sharing program for sidewalk repair. Qualifying homeowners pay a portion of the repair cost; the city covers the rest. The program also fast-tracks the permit and inspection so the work doesn't drag on for months.\n\nWe've poured a lot of these. We know the program rules, the inspector expectations, the form-and-pour spec the city wants, and the paperwork. You call us, we walk the site, give you a quote with the city's contribution factored in, and handle the rest.",
  whatYouGet: [
    "Free on-site assessment of the cited sidewalk section",
    "Fixed-price quote — $3,500 minimum (covers up to ~150 sq ft) plus surveyor fee, itemized",
    "Surveyor coordination and paperwork: $1,000 if the property monument doesn't need to be reset, $2,000 if it does (added to the final bill)",
    "Help filling out and submitting the program paperwork",
    "Permit pulled on your behalf",
    "Demo of the cracked or lifted sidewalk panels",
    "Code-spec base prep, forms, and rebar to City of San Diego standard",
    "Pour and broom finish for slip resistance",
    "Saw-cut control joints to prevent re-cracking",
    "Coordination with the city inspector",
    "Sign-off so the citation is closed out",
  ],
  process: [
    {
      title: "1. Send us your notice",
      body: "Text or email us a photo of the city notice. We'll set up a free site visit, usually within a week.",
    },
    {
      title: "2. Site assessment + quote",
      body: "Ronnie walks the cited section, measures it, and writes you a fixed-price quote with the city's program contribution itemized.",
    },
    {
      title: "3. Paperwork + permit",
      body: "We help you submit the Safe Sidewalks paperwork and pull the permit so the demo can start. You sign; we file.",
    },
    {
      title: "4. Demo + pour",
      body: "Saw-cut the bad panels, demo, base prep, forms, rebar, pour, finish, saw-cut control joints. One pour day for most jobs.",
    },
    {
      title: "5. Inspection sign-off",
      body: "Concrete cures for 7 days. City inspector returns, signs off, citation closes. You're done.",
    },
  ],
  timeline: [
    {
      phase: "Notice → free site visit",
      duration: "Within 1 week",
      note: "Send us a photo of the notice. Ronnie gets out the same week most weeks.",
    },
    {
      phase: "Quote → paperwork submitted",
      duration: "1–2 weeks",
      note: "We help you fill out the program forms; the city processes them.",
    },
    {
      phase: "Permit issued → pour day",
      duration: "2–4 weeks",
      note: "Permit timing depends on city queue. We schedule the demo and pour as soon as it's pulled.",
    },
    {
      phase: "Pour → inspection sign-off",
      duration: "1–2 weeks after pour",
      note: "Concrete cures, inspector returns, citation closed.",
    },
  ],
  costContext:
    "Safe Sidewalks Program work has two cost components on every job: (1) a $3,500 contractor minimum from us that covers up to roughly 150 square feet of sidewalk replacement, and (2) a separate surveyor fee of $1,000 (or $2,000 if your property's survey monument needs to be reset). The surveyor cost is added to the final bill. Larger sidewalk sections, tree-root removal, and base re-grading add to the contractor portion. We itemize every line on the quote so there are no surprises — and we explain how the city's program contribution applies to your specific notice.",
  typicalCost: {
    heading: "What does Safe Sidewalks Program work cost you?",
    rangeSentence:
      "Our contractor minimum on Safe Sidewalks work is $3,500, which covers up to roughly 150 sq ft of sidewalk replacement. A surveyor fee of $1,000–$2,000 is added to the final bill (depending on whether the property monument needs to be reset). Anything beyond ~150 sq ft is priced from $17.22 per square foot for plain flatwork.",
    exampleSentence:
      "A small Safe Sidewalks repair under 150 sq ft typically runs $3,500 from us plus $1,000–$2,000 for the surveyor — total $4,500–$5,500 before the City of San Diego's program contribution is applied to your notice.",
    factors: [
      "Linear feet of sidewalk being replaced (under ~150 sq ft hits the $3,500 minimum)",
      "Surveyor fee — $1,000 standard, $2,000 if the property monument needs to be reset",
      "Number of full-panel replacements vs spot repairs",
      "Tree-root removal scope (often what triggered the citation)",
      "Base condition under the cracked panels",
      "Permit fees (we itemize)",
      "Inspection scheduling",
      "City of San Diego program contribution at the time of repair",
    ],
  },
  callout: {
    title: "Program eligibility (general guidance)",
    body:
      "The Safe Sidewalks Program is open to San Diego homeowners whose sidewalk has been cited or who voluntarily request an inspection. Eligibility, contribution amounts, and program rules can change — call (619) 537-9408 and we'll walk you through what currently applies to your specific notice. " +
      // PLACEHOLDER STAT — REPLACE WITH REAL NUMBER
      "We've handled dozens of Safe Sidewalks Program projects across San Diego County. " +
      "The City's program page is the official source: search 'San Diego Safe Sidewalks Program' for the latest details.",
  },
  faqs: [
    {
      q: "I just got a Safe Sidewalks notice. What do I do first?",
      a: "Call us at (619) 537-9408 or text us a photo of the notice. We'll come out for a free site visit, walk the cited section with you, and explain how the program applies to your specific notice — what the city covers, what you pay, and what the timeline looks like.",
    },
    {
      q: "What is the Safe Sidewalks Program?",
      a: "It's the City of San Diego's cost-sharing program for sidewalk repairs in front of private homes. The program splits the cost between the city and the homeowner for qualifying repairs, and fast-tracks the permitting + inspection process so the work doesn't drag on.",
    },
    {
      q: "Does the program really pay for part of it?",
      a: "Yes. Program rules and contribution amounts are set by the city and can change, but as of recent program guidelines, qualifying repairs receive a substantial city contribution. Your final out-of-pocket is a fraction of full private-pay pricing. We itemize the city's share on your quote so you see exactly where the math lands.",
    },
    {
      q: "What if I ignore the notice?",
      a: "Bad idea. The notice typically gives you a window to address the citation. Ignoring it can lead to escalation — additional fees, a city-ordered repair billed back to you at full cost (no program contribution), and a lien on your property. The program is designed to make the fix affordable. Use it.",
    },
    {
      q: "Who actually pays the contractor?",
      a: "You pay us directly for the work. The city's contribution is paid through the program's cost-share mechanism — depending on how the program is structured at the time of your repair, that's either a credit on your invoice or a city payment to the contractor that reduces what you owe. We walk you through whichever applies.",
    },
    {
      q: "What does 'qualifying repair' mean?",
      a: "The program covers sidewalks that are cracked, lifted, sunken, or otherwise unsafe. It typically does NOT cover purely cosmetic work. The inspector who issued your notice has already flagged your sidewalk as qualifying — that's what the notice means.",
    },
    {
      q: "Do I have to be home for the work?",
      a: "Not for the demo or pour — both happen entirely in the public right-of-way. We do need to coordinate access if you have a gate or driveway crossing the work area. We'll text you the day before each visit.",
    },
    {
      q: "What if there's a tree root pushing up the sidewalk?",
      a: "Common. Roots are often what triggered the citation. We can root-prune as part of the job (within program guidelines) and pour a new sidewalk over the cleared area. For larger trees that threaten to lift the new pour again, we'll talk through root-barrier installation or, in extreme cases, working with the city's urban forestry team.",
    },
    {
      q: "How long does the actual repair take?",
      a: "On pour day, demo + pour is typically a single day. The new concrete is walkable in 24 hours and fully cured in 7–14 days. The full project — from notice to inspector sign-off — usually runs 4–8 weeks total, mostly waiting on permits and inspection windows.",
    },
    {
      q: "Will the new sidewalk match the old?",
      a: "We pour to City of San Diego spec — same width, same broom finish, same control-joint spacing as the rest of your block. New concrete is lighter than weathered concrete for the first year, then weathers in. The transition between old and new will be visible until that happens.",
    },
    {
      q: "Can you handle the paperwork for me?",
      a: "We help — we'll walk you through what the program needs, what to fill out, and where to submit. The paperwork is technically the homeowner's responsibility (your name is on the program agreement), but we don't make you figure it out alone.",
    },
    {
      q: "What if my notice has expired?",
      a: "Call us anyway. The city is generally willing to work with homeowners who are actively addressing the citation, even past the original deadline. We've helped folks restart paused cases — the worst-case scenario is you re-request an inspection, which the program also handles.",
    },
    {
      q: "Can my HOA use this program?",
      a: "The Safe Sidewalks Program is for private homeowners on cited sidewalks. HOAs and commercial properties typically don't qualify for the cost-share. We do plenty of HOA and small-commercial sidewalk work — call us and we'll quote that as a private repair.",
    },
    {
      q: "Why hire Rose Concrete specifically for this?",
      a: "We've poured these jobs before, we know the city's spec, and we know what the inspectors look for. Same in-house crew on every job. Veteran-owned, CA License #1130763, fully insured. And Ronnie shows up — every site visit, every pour day.",
    },
    {
      q: "Will the new sidewalk meet ADA cross-slope requirements?",
      a: "Yes. ADA spec is no more than 2% lateral cross-slope. We grade every Safe Sidewalks pour to that standard, and the inspector verifies it on sign-off. If the existing grade made the old sidewalk non-compliant, we regrade the base before pouring so the new section is in code.",
    },
    {
      q: "What about my driveway approach (the apron at the curb)?",
      a: "If your driveway approach is part of the cited section, we handle it under the same project — the apron gets poured to city spec at the same time as the sidewalk. If the approach is fine but the sidewalk on either side is cited, we can pour the sidewalk and leave your approach untouched. We'll walk this with you during the site visit.",
    },
  ],
  serviceTypeForForm: "safe_sidewalks_program",
  related: [
    {
      title: "Sidewalk Repair (private)",
      href: "/landing/sidewalk-repair-san-diego",
      sub: "No city notice? We still pour residential and HOA sidewalks.",
    },
    {
      title: "Walkways & Sidewalks",
      href: "/services/walkways-sidewalks",
      sub: "All our walkway and sidewalk service options.",
    },
    {
      title: "Driveway Aprons",
      href: "/landing/driveway-aprons-san-diego",
      sub: "Need an apron repair while you're at it?",
    },
  ],
};

// ─── 2. Sidewalk Repair (private, no city notice) ───────────────────────
const sidewalkRepair: LandingPage = {
  slug: "sidewalk-repair-san-diego",
  name: "Sidewalk Repair",
  category: "Sidewalks",
  metaTitle:
    "Sidewalk Repair San Diego — Residential & HOA Concrete | Rose Concrete",
  metaDescription:
    "Cracked, lifted, or hazardous sidewalk? San Diego sidewalk repair contractor. Residential and HOA. CA License #1130763. Free quote: (619) 537-9408.",
  heroEyebrow: "Sidewalk repair · San Diego",
  h1: "Cracked or lifted sidewalk? We replace it clean.",
  heroSub:
    "Residential, HOA, and small-commercial sidewalk repair across San Diego County. Demo the bad section, pour a new one to city spec, walk away with a slip-free, level path.",
  intro:
    "Sidewalk repair is one of the most common calls we get — sometimes from a city notice, more often from a homeowner who tripped on the crack one too many times. Either way, we handle it: demo the bad panels, prep the base, pour a new section to City of San Diego spec, finish with a broom for grip, and walk away with a clean transition.\n\nIf you got a Safe Sidewalks Program notice from the city, see our Safe Sidewalks page — that program splits the cost. If you're paying privately or doing HOA-managed repairs, you're in the right place.",
  whatYouGet: [
    "Free on-site assessment",
    "Demo of cracked, lifted, or hazardous sidewalk sections",
    "Tree-root pruning if root-lift is the cause (within scope)",
    "Compacted base prep to code",
    "Rebar or wire-mesh reinforcement",
    "City-spec width and code-compliant cross-slope",
    "Broom finish for slip resistance",
    "Saw-cut control joints to prevent re-cracking",
    "Permit pulled if work is in the public right-of-way",
    "Workmanship warranty in writing",
  ],
  process: [
    {
      title: "Walk and quote",
      body: "Ronnie walks the section with you, identifies what needs replacing vs spot-repair, and writes a fixed-price quote.",
    },
    {
      title: "Permit + schedule",
      body: "If the section is in the public right-of-way, we pull the permit. Most jobs scheduled within 2 weeks of acceptance.",
    },
    {
      title: "Demo + pour",
      body: "Saw-cut perimeter, break out bad panels, prep base, set forms, pour, finish. One-day pour for most jobs.",
    },
    {
      title: "Cure + inspection",
      body: "Saw-cut control joints, let it cure, schedule city inspection if it's a permit job.",
    },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "Free, fixed-price." },
    { phase: "Permit (if needed)", duration: "1–3 weeks", note: "Depends on city queue." },
    { phase: "Pour day", duration: "1 day", note: "Demo + pour same day for most residential repairs." },
    { phase: "Walkable", duration: "24 hours", note: "Foot traffic only — no carts/strollers for 7 days." },
  ],
  costContext:
    "Sidewalk repair cost depends on linear feet of sidewalk being replaced, base condition (any settling or root-lift adds prep), permit cost if the section is in the right-of-way, and tree-root removal if applicable. We give you a fixed-price quote with everything itemized — no change orders unless the scope changes.",
  typicalCost: {
    heading: "What does sidewalk repair cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Tree-root removal, multiple-panel work, ADA regrading, and HOA off-hours scheduling each add to that baseline.",
    exampleSentence:
      "If your sidewalk is in the City of San Diego and you have a Safe Sidewalks Program notice, see our Safe Sidewalks page — that program has its own pricing structure ($3,500 minimum + surveyor fee, with a city contribution applied). Otherwise, this is straight private-pay sidewalk work.",
    factors: [
      "Linear feet of sidewalk replaced",
      "Number of panels (more panels = better per-sqft pricing)",
      "Tree-root removal scope",
      "Permit fees if right-of-way work",
      "ADA cross-slope requirements",
      "Saturday/weekend scheduling for HOA-managed properties",
    ],
  },
  faqs: [
    {
      q: "Is sidewalk repair my responsibility or the city's?",
      a: "In San Diego, the homeowner is generally responsible for the sidewalk in front of their property. The Safe Sidewalks Program splits the cost on cited repairs — if you have a city notice, see that page.",
    },
    {
      q: "Do I need a permit?",
      a: "If the work is in the public right-of-way (the standard residential sidewalk between the street and your property line), yes. We pull it. Walkways fully on your private property — usually no permit.",
    },
    {
      q: "Can you fix just one bad panel?",
      a: "Yes. We saw-cut along the existing control joints, demo the bad panel, and pour a clean replacement. The new panel will be lighter than the surrounding weathered concrete for the first year.",
    },
    {
      q: "What about tree roots that lifted the sidewalk?",
      a: "We can root-prune within scope and pour over the cleared area. For larger trees we may recommend root barriers to keep the new pour from lifting again. We talk through it during the quote.",
    },
    {
      q: "How long until I can use it?",
      a: "Walkable in 24 hours, full normal use in 14 days. We mark off the wet section so the mail carrier and your neighbors don't step on it.",
    },
    {
      q: "What's the difference between this and the Safe Sidewalks Program?",
      a: "The Safe Sidewalks Program is the city's cost-share program triggered by a city-issued notice — the city pays a portion of the repair. This page is for private-pay sidewalk repair (no city notice). Both use the same crew, same spec, same warranty. If you have a notice, start on the Safe Sidewalks page instead.",
    },
    {
      q: "Can you handle HOA-managed sidewalk repair?",
      a: "Yes. We work directly with HOA property management on multi-property sidewalk repair, with consolidated quotes, COI submittal, and Saturday/weekend scheduling so unit residents aren't disrupted.",
    },
    {
      q: "Do you grind down small lifts as an alternative to replacement?",
      a: "Sometimes — small lifts (under 3/4 inch) can be ground down to remove the trip hazard without replacing the panel. We'll evaluate during the quote and recommend the most honest fix for your specific section.",
    },
    {
      q: "What about ADA cross-slope?",
      a: "We pour every sidewalk to ADA cross-slope spec (no more than 2% lateral slope). If the existing grade made the old sidewalk non-compliant, we'll regrade the base before pouring so the new section meets code.",
    },
  ],
  serviceTypeForForm: "sidewalk",
  related: [
    {
      title: "Safe Sidewalks Program",
      href: "/landing/safe-sidewalks-program-san-diego",
      sub: "Got a city notice? Cost is split with the city.",
    },
    {
      title: "Walkways & Sidewalks",
      href: "/services/walkways-sidewalks",
      sub: "Front walks, side paths, and all our walkway services.",
    },
  ],
};

// ─── 3. Driveway Replacement ────────────────────────────────────────────
const driverepl: LandingPage = {
  slug: "driveway-replacement-san-diego",
  name: "Driveway Replacement",
  category: "Driveways",
  metaTitle: "Driveway Replacement San Diego — Tear Out & New Pour | Rose Concrete",
  metaDescription:
    "Concrete driveway replacement in San Diego. Tear out the cracked slab, pour a new one in 2–3 days. Veteran-owned, CA License #1130763. (619) 537-9408.",
  heroEyebrow: "Driveway replacement · San Diego",
  h1: "Tear out the cracked driveway. Pour a new one in 2–3 days.",
  heroSub:
    "Cracked, sunken, or stained driveway making your house look 20 years older? We demo the old slab, prep the base properly, pour a new one to last decades. Park on it inside a week.",
  intro:
    "Most driveways in San Diego fail at the same time the rest of the house starts feeling its age — 20–30 years in. Hairline cracks turn into chunks. Oil spots become permanent. Settling near the garage means the door scrapes the slab. At a certain point, patching is throwing money at a slab that's done.\n\nReplacement is straightforward when you do it right. Demo the old, prep the base, set forms with the right slope, lay rebar, pour, finish, cure. We handle it end-to-end: in two-to-three days of work spread across about a week, you have a brand-new driveway that'll outlast the next mortgage.",
  whatYouGet: [
    "Demo and haul-off of the existing driveway",
    "Compacted base prep with proper drainage slope",
    "#3 rebar grid (or fiber-mesh on smaller pours)",
    "Choice of finish: broom, smooth-trowel, swirled, or stamped",
    "Saw-cut control joints to prevent random cracking",
    "Coordination with your landscaping or fence work",
    "Workmanship warranty in writing",
  ],
  process: [
    { title: "On-site quote", body: "Ronnie measures, checks the existing slab and base, writes a fixed-price quote — usually same week." },
    { title: "Demo day", body: "Saw-cut the perimeter, break out the old slab, haul it off. Re-grade and compact the base." },
    { title: "Forms + rebar", body: "Set forms to the right slope so water flows away from the garage. Lay rebar in a tied grid." },
    { title: "Pour + finish", body: "Pour 3500-psi mix in a single day. Finish to your chosen texture, saw-cut control joints." },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "Free, on-site, fixed-price." },
    { phase: "Schedule", duration: "1–2 weeks", note: "Most jobs poured within 2 weeks of acceptance." },
    { phase: "Demo + base prep", duration: "1 day", note: "Old slab out, base compacted." },
    { phase: "Forms, rebar, pour", duration: "1–2 days", note: "Pour day is one day for most residential driveways." },
    { phase: "Walkable", duration: "24–48 hours after pour", note: "Foot traffic only." },
    { phase: "Park on it", duration: "7 days after pour", note: "Cars OK; RVs/heavy vehicles wait 14 days." },
  ],
  costContext:
    "Driveway replacement cost depends on square footage, current slab thickness, base condition (does it need re-grading or import?), reinforcement spec, finish choice (broom is base; stamped/decorative adds), and any related work (apron, walkway tie-ins, drainage fixes). We quote a fixed price with everything itemized — no change orders unless you change the scope.",
  typicalCost: {
    heading: "What does driveway replacement cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Stamped, stained, or exposed-aggregate finishes add to that — pattern complexity, color, and material spec all factor in.",
    exampleSentence:
      "Demo and haul-off, base re-grade, rebar spec, finish choice, and apron tie-in (which needs its own city encroachment permit) each shape the final number. We give you a fixed-price written quote at the on-site walk so you see the math before you commit.",
    factors: [
      "Total square footage",
      "Demo and haul-off",
      "Base condition (re-grade or import?)",
      "Reinforcement (rebar grid vs fiber-mesh)",
      "Finish choice (broom · smooth · stamped · stained)",
      "Apron tie-in (separate permit)",
      "Drainage work",
      "Access (narrow side yards add labor)",
    ],
  },
  faqs: [
    { q: "How long before I can park on the new driveway?", a: "Walk on it in 24–48 hours. Cars in 7 days. RVs, work trucks, or heavy trailers — wait 14 days." },
    { q: "Do I need a permit?", a: "Replacing in the same footprint usually doesn't need a permit. Widening, changing the apron, or building a new driveway in a new location — yes. We pull the permit." },
    { q: "What about my garage / cars / kids during the work?", a: "Plan to park on the street for about a week. We'll text you the day-by-day schedule before demo starts. Kids and pets need to stay off until we say walkable." },
    { q: "Can you match my walkway / sidewalk?", a: "Yes for finish texture. Color match on aged concrete is harder — there'll be a visible seam between new and old until the new section weathers in." },
    { q: "What's the warranty?", a: "Workmanship warranty in writing. Hairline cracks at the control joints are normal — those are designed to crack there. Settling, structural cracks, or finish failure within the warranty window — we come back at our cost." },
    { q: "Will the new driveway crack?", a: "Hairline cracks at the saw-cut control joints are designed and expected — that's where concrete is told to crack so it doesn't crack random. Random cracking through the field of the slab is unusual when the base prep, rebar, and joint spacing are done right. Our warranty covers any structural cracking." },
    { q: "How thick will the slab be?", a: "Standard residential driveway is 4 inches. Pads designed to hold an RV or work truck get 6 inches with doubled rebar. We'll tell you which spec your project needs based on what you'll park on it." },
    { q: "Do you handle the demo and haul-off?", a: "Yes. Demo, break-out, and haul-off are part of every replacement quote. We saw-cut the perimeter, break out the slab in sections, and haul it to a recycling yard." },
    { q: "Can you pour around my existing landscaping?", a: "Yes. We'll walk the job with you before demo and flag anything we need to protect or move. Sprinklers in the path get cleanly capped so your landscaper can re-route after." },
  ],
  serviceTypeForForm: "driveway",
  related: [
    { title: "Driveway Extensions", href: "/landing/driveway-extensions-san-diego", sub: "Widening for a second car or RV." },
    { title: "Driveway Aprons", href: "/landing/driveway-aprons-san-diego", sub: "City right-of-way apron work." },
    { title: "Driveways (full service overview)", href: "/services/driveways" },
  ],
};

// ─── 4. Driveway Extensions ─────────────────────────────────────────────
const driveExt: LandingPage = {
  slug: "driveway-extensions-san-diego",
  name: "Driveway Extensions",
  category: "Driveways",
  metaTitle: "Driveway Extensions & Widening in San Diego | Rose Concrete",
  metaDescription:
    "Concrete driveway extension and widening in San Diego. Add room for a second car, an RV, or a third stall. CA License #1130763. (619) 537-9408.",
  heroEyebrow: "Driveway extensions · San Diego",
  h1: "Need room for a second car? We widen the driveway clean.",
  heroSub:
    "Add 4 feet for a second car, 8 feet for a third stall, or a full RV pad alongside the existing driveway. Tied into the existing slab so it looks like one driveway, not a patch.",
  intro:
    "Driveway extensions are how most San Diego homeowners solve the 'we need to park three cars and we have a two-car driveway' problem without buying a bigger house. We widen the existing driveway, tie the new pour into the old, and finish so the seam is clean and the slope still drains to the street.\n\nMost extensions take a single demo day (small landscape removal + base prep) and a single pour day. Within a week you've got the parking footprint you actually need.",
  whatYouGet: [
    "Site survey to mark exact footprint and avoid utility lines",
    "Removal of grass, planters, or pavers in the new pour zone",
    "Compacted base prep matched to existing driveway elevation",
    "Doweled tie-in to the existing slab so the seam stays tight",
    "Rebar grid or fiber-mesh reinforcement",
    "Matching finish (broom, smooth, exposed aggregate, stamped)",
    "Drainage slope that ties into existing storm flow",
    "Workmanship warranty in writing",
  ],
  process: [
    { title: "Walk and design", body: "Ronnie measures, marks the footprint, checks for utility lines, and writes a fixed-price quote." },
    { title: "Site prep", body: "Remove grass / pavers / planters. Compact base to match existing driveway elevation." },
    { title: "Tie-in + forms", body: "Drill and dowel rebar into the existing slab so the new pour locks into the old. Set forms." },
    { title: "Pour + finish", body: "Pour 3500-psi mix, finish to match existing texture, saw-cut control joints." },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "Free, on-site." },
    { phase: "Schedule", duration: "1–2 weeks", note: "Most extensions poured within 2 weeks." },
    { phase: "Prep + pour", duration: "2 days", note: "Prep one day, pour the next." },
    { phase: "Park on it", duration: "7 days after pour", note: "Cars OK." },
  ],
  costContext:
    "Extension cost depends on the square footage being added, what we're tearing out (grass is easy, pavers cost more in labor), how much base import is needed, whether the tie-in spans a control joint, and finish match (matching stamped concrete costs more than matching broom).",
  typicalCost: {
    heading: "What does a driveway extension cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Extensions can run a touch higher per-sqft than full driveways because the tie-in work + smaller pour volume are less labor-efficient.",
    exampleSentence:
      "What's being torn out (grass is fastest, pavers cost more in labor), how much base import is needed, and finish-match complexity each shape the final number. We give you a fixed-price written quote at the on-site walk.",
    factors: [
      "Square footage added",
      "What's being torn out (grass, pavers, gravel)",
      "Base import for new pour zone",
      "Doweled tie-in to existing slab",
      "Finish match (broom is easiest)",
      "Drainage tie-in to existing flow",
    ],
  },
  faqs: [
    { q: "Will the new section match the old?", a: "Texture: yes. Color: close, but new concrete is always lighter than weathered concrete for the first year. The seam is visible until the new section weathers in." },
    { q: "Can the extension hold an RV?", a: "If you tell us up front, we'll thicken the slab to 6 inches and add extra rebar. Standard 4-inch driveway concrete will crack under sustained RV weight; designed-for-RV concrete won't." },
    { q: "Do I need a permit?", a: "Extensions within your existing driveway curb cut usually don't need a permit. Adding a new curb cut to the street does — that's a separate apron job. We'll tell you which applies." },
    { q: "What about my landscaping?", a: "We'll walk the new footprint with you and flag what needs to come out. Sprinklers in the path get capped cleanly so your landscaper can re-route after." },
    { q: "How does the tie-in work?", a: "We drill 12-inch deep holes into the existing slab edge, epoxy in rebar dowels, then tie those dowels into the new section's rebar grid. The two slabs lock together — they expand and contract as one." },
  ],
  serviceTypeForForm: "driveway_extension",
  related: [
    { title: "Driveway Replacement", href: "/landing/driveway-replacement-san-diego" },
    { title: "RV Pads", href: "/landing/rv-pads-san-diego" },
    { title: "Driveways (full service)", href: "/services/driveways" },
  ],
};

// ─── 5. Driveway Aprons ─────────────────────────────────────────────────
const driveApron: LandingPage = {
  slug: "driveway-aprons-san-diego",
  name: "Driveway Aprons",
  category: "Driveways",
  metaTitle: "Driveway Apron Repair & Replacement in San Diego | Rose Concrete",
  metaDescription:
    "Concrete driveway apron contractor in San Diego. City right-of-way work, encroachment permit included. CA License #1130763. (619) 537-9408.",
  heroEyebrow: "Driveway aprons · San Diego",
  h1: "Cracked or sunken apron at the curb? We pour to city spec.",
  heroSub:
    "The apron is the section of driveway in the public right-of-way between the curb and your property. We pull the encroachment permit, demo, pour to city spec, and pass inspection — without you running paperwork.",
  intro:
    "The driveway apron is the strip between the street curb and your property line. It's technically in the public right-of-way, which means any work needs a city encroachment permit and an inspection at the end. That's the part that scares most homeowners off and lets a cracked apron sit for years.\n\nWe handle the whole thing — permit, demo, pour, inspection. The apron gets poured to city spec (thickness, slope, joint placement, ADA cross-slope where applicable) so it passes inspection the first time.",
  whatYouGet: [
    "Encroachment permit pulled on your behalf",
    "USA dig-alert + utility locate before demo",
    "Demo of the cracked or sunken apron",
    "Compacted base prep to city standard",
    "Rebar to city specification",
    "Pour matching the existing driveway slope and texture",
    "Saw-cut control joints to city spacing",
    "Coordination with city inspector for sign-off",
  ],
  process: [
    { title: "Site visit + quote", body: "Ronnie measures the apron, photographs the existing condition, and writes a fixed-price quote with the permit cost itemized." },
    { title: "Permit + locate", body: "We pull the encroachment permit and submit the utility locate (USA dig-alert)." },
    { title: "Demo + pour", body: "Saw-cut, demo, prep, form, pour, finish. Single day for most residential aprons." },
    { title: "Inspection", body: "Cure for 7 days, then meet the city inspector for sign-off." },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "Free, on-site." },
    { phase: "Permit + locate", duration: "2–4 weeks", note: "Depends on city queue." },
    { phase: "Pour day", duration: "1 day", note: "Demo + pour same day." },
    { phase: "Inspector sign-off", duration: "1–2 weeks after cure", note: "Inspector visits within their schedule." },
  ],
  costContext:
    "Apron cost depends on square footage, apron thickness (city spec varies by traffic load), permit fees (set by city, itemized on your quote), and any curb-cut modification. If the curb itself needs repair or a new curb cut is part of the scope, that adds.",
  typicalCost: {
    heading: "What does a driveway apron cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Apron work runs a bit above the floor because of the city encroachment permit, the thicker city-spec slab, and inspection coordination.",
    exampleSentence:
      "Apron square footage, slab thickness (city spec varies by traffic load), permit fees, and any curb modification each shape the final number. We itemize everything on the written quote so you see what the city's portion is and what ours is.",
    factors: [
      "Apron square footage",
      "Slab thickness (city spec varies)",
      "Encroachment permit fees",
      "Curb modification (if any)",
      "Match to existing driveway texture",
      "Inspector coordination",
    ],
  },
  faqs: [
    { q: "Why does the apron need a permit when my driveway didn't?", a: "Apron work is in the public right-of-way. Driveway work on your private property generally isn't. The right-of-way work always needs an encroachment permit and an inspection." },
    { q: "Can you do the apron at the same time as the rest of my driveway?", a: "Yes — and we usually recommend it so the colors match and there's no cold-joint between fresh apron concrete and aged driveway concrete." },
    { q: "What if my apron is just cosmetic-cracked?", a: "We can sometimes resurface or saw-cut and replace just the cracked panels. Walk-the-job during the quote — we'll tell you whether resurface is honest or whether you need a full replacement." },
    { q: "Do I need to be home for the work?", a: "Not for the demo and pour — both happen entirely in the right-of-way. We do need the driveway accessible (no cars parked on it) on demo day." },
    { q: "What about the curb?", a: "If the curb itself is broken or sunken, that's a separate scope (and sometimes the city's responsibility, not yours). We'll flag it during the site visit and coordinate as needed." },
  ],
  serviceTypeForForm: "driveway_apron",
  related: [
    { title: "Driveway Replacement", href: "/landing/driveway-replacement-san-diego" },
    { title: "Driveways (full service)", href: "/services/driveways" },
    { title: "Walkways & Sidewalks", href: "/services/walkways-sidewalks" },
  ],
};

// ─── 6. RV Pads ─────────────────────────────────────────────────────────
const rvPads: LandingPage = {
  slug: "rv-pads-san-diego",
  name: "RV Pads",
  category: "Specialty",
  metaTitle: "Concrete RV Pads in San Diego — Reinforced for Weight | Rose Concrete",
  metaDescription:
    "Concrete RV pads, boat-trailer pads, and heavy-vehicle parking in San Diego. Reinforced 6-inch slab, drainage included. CA License #1130763. (619) 537-9408.",
  heroEyebrow: "RV pads · San Diego",
  h1: "RV, boat, or trailer parking pad — built for the weight.",
  heroSub:
    "Standard 4-inch driveway concrete cracks under sustained RV weight. We pour 6-inch reinforced pads designed for the long park — your rig sits where it sits without imprinting.",
  intro:
    "Parking an RV or boat trailer on standard residential concrete is how most homeowners discover that a 4-inch slab isn't built for sustained 8,000-pound point loads. Six months in, you've got crack lines under each tire and a low spot under the tongue jack.\n\nWe build pads engineered for the weight: 6-inch slab, doubled rebar grid, control joints sized for the loads, and proper drainage so water doesn't pond under the tires. The pad lasts as long as you own the rig.",
  whatYouGet: [
    "Site survey to size the pad to your specific rig",
    "Compacted base prep with import as needed",
    "6-inch reinforced slab (vs the 4-inch standard for cars)",
    "Doubled rebar grid for sustained point loads",
    "Drainage slope so water doesn't pond under tires",
    "Optional tie-in to existing driveway",
    "Choice of finish (broom is standard for RV pads — grip + easy cleaning)",
    "Workmanship warranty in writing",
  ],
  process: [
    { title: "Measure your rig", body: "Tell us the rig dimensions and tire layout. Ronnie sizes the pad with extra room for setup gear." },
    { title: "Site prep", body: "Remove existing surface (grass, pavers, gravel). Compact and import base material as needed." },
    { title: "Forms + double rebar", body: "Set forms to spec, lay doubled rebar grid (heavier than a standard driveway)." },
    { title: "Pour + finish", body: "Pour 6-inch 3500-psi mix, broom finish, saw-cut control joints." },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "Free, on-site." },
    { phase: "Schedule", duration: "1–2 weeks", note: "Most pads poured within 2 weeks." },
    { phase: "Prep + pour", duration: "2 days", note: "Prep one day, pour next." },
    { phase: "Park on it", duration: "14 days after pour", note: "Heavy vehicles need full cure — don't park early." },
  ],
  costContext:
    "RV pad cost depends on square footage (sized to your rig), base condition (slope and import requirements), reinforcement spec, drainage scope, and any tie-in to existing concrete. The 6-inch slab uses 50% more concrete per square foot than a standard driveway — material cost reflects that.",
  typicalCost: {
    heading: "What does an RV pad cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. RV pads run a bit higher per-sqft than a standard driveway because the 6-inch slab uses 50% more concrete than the 4-inch standard, plus doubled rebar and drainage spec for the sustained weight.",
    exampleSentence:
      "Pad dimensions (sized to your rig), base import (if your soil needs it), and any tie-in to the existing driveway each shape the final number. We give you a fixed-price written quote at the on-site walk.",
    factors: [
      "Pad dimensions (sized to your rig)",
      "Slab thickness (6-inch is standard for RV)",
      "Doubled rebar grid",
      "Base import (poor existing soil)",
      "Drainage slope and channel drains",
      "Tie-in to existing driveway",
    ],
  },
  faqs: [
    { q: "Why does an RV pad need to be 6 inches?", a: "Sustained point loads from a parked RV concentrate weight at each tire. A 4-inch slab will crack and depress under those loads within months. A 6-inch slab with doubled rebar handles them indefinitely." },
    { q: "Can the pad sit alongside my existing driveway?", a: "Yes — we tie it in with rebar dowels so the pad and driveway behave as one slab and the seam stays tight." },
    { q: "Do I need a permit?", a: "RV pads on private property usually don't need a permit. Some HOAs have rules about RV parking that apply — check those before you sign with us." },
    { q: "What about the leveling jacks / tongue weight?", a: "Tongue jacks concentrate even more weight than tires. We'll add a thickened spot or pad-extension under the jack location if you tell us where it'll sit." },
    { q: "How long until I can park the rig on it?", a: "14 days after pour. Don't cheat the cure on a heavy vehicle — early loading creates cracks that don't go away." },
  ],
  serviceTypeForForm: "rv_pad",
  related: [
    { title: "Driveway Extensions", href: "/landing/driveway-extensions-san-diego" },
    { title: "Driveways (full service)", href: "/services/driveways" },
    { title: "Paving", href: "/services/paving" },
  ],
};

// ─── 7. Pool Decks ──────────────────────────────────────────────────────
const poolDecks: LandingPage = {
  slug: "pool-decks-san-diego",
  name: "Pool Decks",
  category: "Specialty",
  metaTitle: "Concrete Pool Decks San Diego — Slip-Resistant Finishes | Rose Concrete",
  metaDescription:
    "San Diego pool deck contractor. Slip-resistant, heat-friendly concrete finishes around your pool. Stamped, exposed aggregate, broomed. CA License #1130763.",
  heroEyebrow: "Pool decks · San Diego",
  h1: "Pool decks built for wet feet and California sun.",
  heroSub:
    "Slip-resistant finishes that stay cool under bare feet, drain water away from the pool, and hold up to chlorine, sunscreen, and 20 summers of cannonballs.",
  intro:
    "Pool decks are the highest-stakes flatwork on a residential property. Slip-and-fall risk is real. Heat under bare feet matters when your kids are running circles around the pool in July. Drainage has to work — water needs to flow away from the pool, not into the coping.\n\nWe pour pool decks with finish, color, and slope chosen specifically for the pool environment: slip-resistant texture (exposed aggregate, broomed, or textured stamped), light color to stay cool, and drainage slope tied into the deck drains.",
  whatYouGet: [
    "Site survey of pool perimeter and existing drainage",
    "Removal of existing deck surface (or pour-over assessment if salvageable)",
    "Compacted base with drainage slope away from pool",
    "Rebar reinforcement",
    "Choice of slip-resistant finish: exposed aggregate, broom, textured stamp",
    "Light color options to stay cool under bare feet",
    "Coordination with pool coping and deck drains",
  ],
  process: [
    { title: "Walk and plan", body: "Ronnie walks the pool perimeter, talks finish + color + drainage, writes a fixed-price quote." },
    { title: "Demo", body: "Remove existing deck surface (often pavers, dated stamped concrete, or worn slab)." },
    { title: "Forms + drainage", body: "Set forms to slope away from pool, integrate with existing deck drains, lay rebar." },
    { title: "Pour and finish", body: "Pour, apply chosen slip-resistant finish, cure." },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "Free, on-site." },
    { phase: "Schedule", duration: "1–3 weeks", note: "Pool deck timing also depends on whether the pool needs to be drained." },
    { phase: "Prep + pour", duration: "3–4 days", note: "Demo, prep, pour, finish across the work." },
    { phase: "Walk on it", duration: "48 hours", note: "Foot traffic only — no furniture for 7 days, no chairs/umbrellas dragged for 14." },
  ],
  costContext:
    "Pool deck cost depends on linear feet around the pool, deck width, finish choice (broom is base; exposed aggregate and stamped add), color choice, and whether existing coping needs to be reset. Drainage scope (deck drains, channel drains) is a major variable.",
  typicalCost: {
    heading: "What does a pool deck cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Pool decks usually use one of the slip-resistant decorative finishes (exposed aggregate or textured stamp), which add to that baseline.",
    exampleSentence:
      "Linear feet around the pool, deck width, finish choice, color, drainage scope, and whether the existing coping needs to be reset all shape the final number. We give you a fixed-price written quote at the on-site walk.",
    factors: [
      "Linear feet around the pool + deck width",
      "Finish (broom · exposed aggregate · stamped)",
      "Color choice (light colors stay cooler)",
      "Coping reset (if old coping is failing)",
      "Drainage system (deck drains, channel drains)",
      "Whether pool needs partial drain for work",
    ],
  },
  faqs: [
    { q: "What's the most slip-resistant pool deck finish?", a: "Exposed aggregate is the gold standard — natural pebble texture gives feet something to grip even with a layer of water. Broomed concrete is a close second and a lot cheaper. Smooth or polished concrete is a hard no around water." },
    { q: "Will the deck be hot under bare feet?", a: "Concrete absorbs heat, period. Lighter colors absorb less. We use light gray, tan, or color-stained finishes to keep deck temperature manageable. Dark stamped concrete around a pool gets uncomfortably hot in afternoon sun." },
    { q: "Do I need to drain the pool?", a: "Sometimes — if we're replacing coping or the deck is poured right against the pool edge, we may need a partial drain. We'll tell you during the quote so you can coordinate with your pool service." },
    { q: "Can you pour over my existing pool deck?", a: "If the existing deck is structurally sound (no major cracks, no settling, no failed coping), yes — a 2-inch overlay is an option. If the deck has structural issues, we tear out and start over." },
    { q: "How long until the kids can swim again?", a: "Pool itself is unaffected if we don't have to drain it. The deck is foot-walkable in 48 hours. Furniture, umbrellas, and dragging chairs — wait 14 days." },
    { q: "Will the deck slope correctly so water flows away from the pool?", a: "Yes — we grade every pool deck with positive slope away from the coping (typically 1/4 inch per foot). Water never flows back into the pool, which is what damages tile and coping over time." },
    { q: "Can I add a pergola or fire pit later?", a: "Yes, but tell us up front — we'll thicken the slab and add extra rebar where the post bases or pad will sit. Adding heavy structural loads to standard 4-inch deck concrete causes cracking." },
    { q: "What about my existing coping?", a: "If the coping is in good shape, we pour the new deck right up to it with a clean expansion joint. If coping is cracked or pulling away, we recommend resetting it as part of the project — saves you having to redo the deck again later." },
  ],
  serviceTypeForForm: "pool_deck",
  related: [
    { title: "Stamped Concrete Patios", href: "/landing/stamped-concrete-patios-san-diego" },
    { title: "Decorative Concrete (full service)", href: "/services/decorative-concrete" },
    { title: "Exposed Aggregate", href: "/services/exposed-aggregate" },
  ],
};

// ─── 8. Stamped Concrete Patios ─────────────────────────────────────────
const stampedPatio: LandingPage = {
  slug: "stamped-concrete-patios-san-diego",
  name: "Stamped Concrete Patios",
  category: "Patios",
  metaTitle: "Stamped Concrete Patios San Diego — Tile, Slate, Wood Looks | Rose Concrete",
  metaDescription:
    "Stamped concrete patio contractor in San Diego. Tile, slate, and wood-grain looks at concrete prices. CA License #1130763. (619) 537-9408.",
  heroEyebrow: "Stamped patios · San Diego",
  h1: "A high-end patio look without the high-end price.",
  heroSub:
    "Stamped concrete that reads like slate, tile, or wood plank from across the yard — at a fraction of the price of the real thing. Built to handle SoCal sun for years.",
  intro:
    "Stamped concrete is the cheat code for a custom-look backyard. The pattern is pressed into wet concrete using textured mats, then colored with integral pigment or surface stain. Done well, it reads as slate, tile, brick, or wood plank from any normal viewing distance — and it costs a fraction of what the real material installed would.\n\nDone poorly, stamped concrete looks fake from across the yard, with bleeding pattern lines and washed-out color. We do all the stamping in-house, so the same hands that pour also stamp. That's the difference.",
  whatYouGet: [
    "Sample boards at the quote — see and feel the actual finish",
    "Choice of stamp pattern (slate, tile, brick, wood plank, ashlar, etc.)",
    "Choice of color: integral pigment, surface stain, or both",
    "Compacted base prep and proper drainage slope",
    "Rebar or fiber-mesh reinforcement",
    "Stamp work while concrete is still workable",
    "Maintenance instructions",
  ],
  process: [
    { title: "Pick the look", body: "Ronnie brings sample boards. You pick stamp pattern, base color, and accent color from real samples." },
    { title: "Prep + pour", body: "Standard base prep, forms, rebar. Pour 3500-psi with integral color if chosen." },
    { title: "Stamp", body: "While the slab is still workable, mats are pressed into the concrete in the chosen pattern." },
    { title: "Stain (optional)", body: "If you chose surface stain, we apply it after the slab cures." },
  ],
  timeline: [
    { phase: "Quote + sample review", duration: "Same week", note: "Free, on-site, with sample boards." },
    { phase: "Schedule", duration: "1–3 weeks", note: "Stamped jobs need a longer prep window for color/pattern coordination." },
    { phase: "Prep + pour + stamp", duration: "1–2 days", note: "Pour and stamp same day; finish work into day 2." },
    { phase: "Stain (if chosen)", duration: "5–10 days after pour", note: "Cure first, then stain." },
  ],
  costContext:
    "Stamped patio cost depends on square footage, pattern complexity (single-stamp is base; multi-stamp ashlar with accent borders adds), color depth (integral pigment vs added surface stain), and border or score-line accents.",
  typicalCost: {
    heading: "What does a stamped patio cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Stamped concrete adds to that — pattern complexity, color depth, and accent borders all factor in. We give you a fixed-price quote at the on-site walk so you see the math before you commit.",
    exampleSentence:
      "Single-stamp slate or wood plank in a single integral color is at the lower end of the stamped range. Multi-stamp ashlar with accent borders and surface stain on top of integral color is at the top.",
    factors: [
      "Square footage",
      "Pattern complexity (single vs multi-stamp)",
      "Color depth (integral pigment + surface stain)",
      "Border or accent score lines",
      "Site prep + drainage",
      "Whether overlay on existing slab is possible",
    ],
  },
  faqs: [
    { q: "Will it actually look like slate / tile / wood?", a: "From any normal viewing distance — yes. Up close on hands and knees, it reads as concrete. Most folks who walk past at standing height never realize it's concrete." },
    { q: "How long does stamped color last?", a: "Integral color (mixed into the concrete) lasts the lifetime of the slab. Surface stains fade over time and need refresh — figure 5–7 years on a high-sun patio." },
    { q: "Is stamped concrete slippery?", a: "Stamping creates real surface texture, so it's grippier than smooth concrete even when wet. For pool decks we pick a stamp pattern with deeper texture for extra grip." },
    { q: "Can stamping go on top of my existing patio?", a: "Sometimes — with a 1–2 inch overlay, if the existing slab is structurally sound. We'll evaluate during the quote." },
    { q: "What's the maintenance?", a: "Light pressure-wash once a year. That's it for normal use." },
    { q: "How do I pick a pattern?", a: "Ronnie brings sample boards to the quote with the actual stamps and colors so you see and feel the finish on real concrete — not a Pinterest screenshot. Most folks pick within 15 minutes once they have the boards in hand." },
    { q: "Can I do multiple patterns or borders?", a: "Yes — a common move is a slate pattern in the field with a brick border at the perimeter. Or scoring lines around the BBQ pad to define zones. Adds modest cost and a lot of visual interest." },
    { q: "How long does the work take?", a: "Pour and stamp happen on day one. Stain (if chosen) goes on after a 5–10 day cure. Total project window: about a week to two weeks from pour day to ready-to-use, depending on whether you chose surface stain." },
    { q: "Can I get color samples to take home?", a: "Yes — Ronnie leaves you with cured 4×4 sample tiles in your chosen color so you can see how it looks under your actual yard light, morning vs evening, dry vs wet. No pressure to commit at the quote." },
  ],
  serviceTypeForForm: "patio",
  related: [
    { title: "Patios (full service)", href: "/services/patios" },
    { title: "Decorative Concrete", href: "/services/decorative-concrete" },
    { title: "Pool Decks", href: "/landing/pool-decks-san-diego" },
  ],
};

// ─── 9. Commercial Flatwork ─────────────────────────────────────────────
const commercial: LandingPage = {
  slug: "commercial-flatwork-san-diego",
  name: "Commercial Flatwork",
  category: "Commercial",
  metaTitle: "Commercial Concrete Flatwork in San Diego | Rose Concrete",
  metaDescription:
    "Small commercial concrete contractor in San Diego. Coffee-shop patios, retail walks, light-industrial pads. Veteran-owned, fully insured. (619) 537-9408.",
  heroEyebrow: "Commercial · San Diego",
  h1: "Small commercial concrete — done on schedule.",
  heroSub:
    "Coffee-shop patios, retail walkways, light-industrial pads, restaurant outdoor seating. We work nights and weekends if your business needs zero downtime.",
  intro:
    "Most San Diego concrete contractors either chase commercial-only or residential-only. We do both — the same crew that pours your driveway also pours your tenant-improvement walkway. The difference for commercial work is scheduling: we work nights and weekends if your operation needs zero customer-facing downtime.\n\nWe focus on small commercial — under ~5,000 square feet per pour. Coffee shops, retail patios, restaurant outdoor seating, light-industrial pads, and tenant-improvement work where the GC needs concrete on a tight subcontractor schedule.",
  whatYouGet: [
    "Site walk with property manager / GC / owner",
    "Fixed-price quote with schedule milestones",
    "Insurance certificates pre-coordinated with property management",
    "Off-hours work option (nights, weekends, before-open) at no premium for established clients",
    "ADA-compliant slope and joint placement on customer-facing surfaces",
    "Coordination with electrical, plumbing, and other trades on TI projects",
    "Saw-cut control joints, broom or stamped finish",
  ],
  process: [
    { title: "Site walk + scope", body: "Walk the project with the GC, owner, or property manager. Identify scope, schedule constraints, and trade coordination." },
    { title: "Insurance + permit", body: "Submit insurance certificates to property management. Pull permits if scope requires them." },
    { title: "Pour", body: "Off-hours if needed. Standard prep + reinforcement + finish per spec." },
    { title: "Walk-through + sign-off", body: "Punch-list walk with GC or owner. We come back for any items immediately." },
  ],
  timeline: [
    { phase: "Quote", duration: "Same week", note: "On-site walk + fixed-price written quote." },
    { phase: "Schedule", duration: "Per project", note: "We work to GC schedule on TI work. Standalone commercial jobs typically scheduled within 2 weeks." },
    { phase: "Pour", duration: "1–3 days", note: "Depends on square footage and finish complexity." },
    { phase: "Cure to open", duration: "7–14 days", note: "Foot traffic at 24–48 hours; full commercial use at 14 days." },
  ],
  costContext:
    "Commercial cost depends on square footage, finish requirements (broom vs decorative), schedule constraints (off-hours adds), reinforcement spec (commercial often calls for heavier rebar than residential), permit requirements, and trade coordination on tenant-improvement work.",
  typicalCost: {
    heading: "What does small commercial concrete cost?",
    rangeSentence:
      "Concrete flatwork from Rose Concrete starts at $17.22 per square foot for plain broom finish. Commercial-spec rebar (heavier than residential), ADA cross-slope work, off-hours scheduling, and decorative finishes each add to that baseline.",
    exampleSentence:
      "Off-hours scheduling is no-premium for established clients; for one-off projects there's a small bump for nights/weekends, quoted up front. We give you a fixed-price written quote with schedule milestones at the on-site walk.",
    factors: [
      "Square footage",
      "Finish (broom · decorative · stamped)",
      "Reinforcement (heavier than residential)",
      "Permit + insurance certificates",
      "Off-hours scheduling (one-off vs established client)",
      "Trade coordination on TI work (electrical, plumbing in-slab)",
      "ADA compliance scope",
    ],
  },
  faqs: [
    { q: "Do you work for general contractors as a sub?", a: "Yes. We're licensed (CA #1130763), fully insured, and carry Workers' Comp. Send us your sub package and we'll fill it out." },
    { q: "Can you work nights or weekends?", a: "Yes. For established clients, off-hours is no-premium. For one-off projects there may be a small bump for nights/weekends — we quote it up front." },
    { q: "ADA compliance — do you handle that?", a: "Yes. Cross-slope, ramp slope, detectable warnings, joint placement — we pour to ADA spec on every customer-facing surface." },
    { q: "What's the largest job you handle?", a: "Up to ~5,000 square feet per single pour. Larger than that we'll bring in additional crews — call us and we'll talk about it." },
    { q: "Can you handle TI coordination with other trades?", a: "Yes. We've coordinated with electricians (in-slab conduit), plumbers (drain placement), and HVAC (slab penetrations) on TI work. Tell us early what's coming and we'll plan around it." },
  ],
  serviceTypeForForm: "commercial_flatwork",
  related: [
    { title: "Paving", href: "/services/paving" },
    { title: "Concrete Drainage Solutions", href: "/landing/concrete-drainage-solutions-san-diego" },
    { title: "Walkways & Sidewalks", href: "/services/walkways-sidewalks" },
  ],
};

// ─── 10. Concrete Drainage Solutions ────────────────────────────────────
const drainage: LandingPage = {
  slug: "concrete-drainage-solutions-san-diego",
  name: "Concrete Drainage Solutions",
  category: "Drainage",
  metaTitle: "Concrete Drainage Solutions San Diego — Standing Water & French Drains | Rose Concrete",
  metaDescription:
    "Standing water in your yard? San Diego concrete contractor specializing in drainage. French drains, swales, and graded concrete. CA License #1130763. (619) 537-9408.",
  heroEyebrow: "Drainage · San Diego",
  h1: "Standing water? Soggy patio? We fix the cause, not the puddle.",
  heroSub:
    "Concrete drainage solutions integrated with new pours: french drains, channel drains, regraded slabs, and swales. Water flows away from your house instead of toward it.",
  intro:
    "Standing water in your backyard is rarely a 'just absorb it' problem. It's a grading or drainage problem that gets worse every winter. Patios slope toward the house. Driveways pond water against the garage door. Side yards swamp during a normal storm because there's no path for water to leave.\n\nWe fix this with a combination of regraded concrete, french drains under the new slab, and channel drains where water collects. The fix gets engineered into the pour itself — not added on as an afterthought.",
  whatYouGet: [
    "Site assessment of where water is coming from and where it needs to go",
    "Demo of mis-graded slabs (patio sloping wrong, etc.)",
    "Excavation for french drain trenches",
    "Perforated drain pipe + filter fabric + gravel backfill",
    "Channel drains at low points if needed",
    "Regraded concrete pour with proper slope (1/4-inch per foot away from house)",
    "Tie-in to existing storm drain or daylight discharge",
    "Workmanship warranty in writing",
  ],
  process: [
    { title: "Site assessment", body: "Ronnie walks the property during dry season (or right after a rain if you can show us the standing water). Identifies cause." },
    { title: "Drainage design", body: "Decide french drain vs channel drain vs regrading vs combination. Quote includes the engineered solution." },
    { title: "Demo + drain install", body: "Demo problem slabs. Excavate drain trenches. Install pipe, filter fabric, gravel." },
    { title: "Pour + grade", body: "Re-pour concrete with proper slope. Tie drainage discharge to storm drain or daylight." },
  ],
  timeline: [
    { phase: "Site visit", duration: "Same week", note: "Free, on-site. Best after a rain so we see the water." },
    { phase: "Quote", duration: "Within a week of visit", note: "Includes drainage design + concrete scope." },
    { phase: "Schedule", duration: "1–3 weeks", note: "Bigger drainage scopes need a longer prep window." },
    { phase: "Work", duration: "3–5 days", note: "Demo, drain install, pour, finish across the work." },
  ],
  costContext:
    "Drainage solution cost depends on the scope of demo, linear feet of french drain trenched, drain pipe and gravel materials, channel-drain hardware (if needed), distance to discharge point, and the square footage of concrete being repoured. The drainage portion is often more than the concrete portion — but it's what actually fixes the problem.",
  typicalCost: {
    heading: "What does drainage work cost?",
    rangeSentence:
      "Drainage projects vary widely. French drains run $40–$70 per linear foot installed. Re-pouring mis-graded concrete adds $9–$13/sqft on top.",
    exampleSentence:
      "A typical 30-ft french drain along the side yard runs $1,200–$2,100. Re-pouring a 200-sqft mis-graded patio with integrated drainage runs $2,800–$4,200.",
    factors: [
      "Linear feet of french drain trenched",
      "Demo of mis-graded concrete (if any)",
      "Channel-drain hardware",
      "Distance to discharge point",
      "Permit if connecting to public storm drain",
      "Square footage of concrete being repoured",
      "Excavation difficulty (rocky soil adds)",
    ],
  },
  faqs: [
    { q: "Can't I just add a drain without redoing the concrete?", a: "Sometimes — if the slab itself is graded correctly and water is just collecting in a single low spot. More often the slab is mis-graded and water flows the wrong way. In that case the drain alone can't fix it; the slab has to be regraded too." },
    { q: "What's a french drain?", a: "A perforated pipe in a gravel-filled trench, wrapped in filter fabric. Water seeps through the gravel into the pipe and flows downhill to a discharge point. Invisible after install — just looks like a strip of gravel at grade." },
    { q: "Where does the water go after the drain?", a: "Either to the public storm drain (if you have a connection in your yard) or 'daylighted' to a downhill point on your property where it can run off without ponding. We pick the right discharge during the design." },
    { q: "Do I need a permit for a drainage system?", a: "French drains and regraded concrete on private property typically don't need a permit. Connections to the public storm drain do — we pull the permit if applicable." },
    { q: "Will it really fix the standing water?", a: "Yes — when the design accounts for where the water comes from. We don't pour and pray. We figure out the source first, then design the path of least resistance for the water to leave." },
  ],
  serviceTypeForForm: "drainage",
  related: [
    { title: "Patios", href: "/services/patios", sub: "Patio drainage often comes up during a new patio quote." },
    { title: "Driveway Replacement", href: "/landing/driveway-replacement-san-diego" },
    { title: "Retaining Walls", href: "/services/retaining-walls", sub: "Retaining walls always have integrated drainage." },
  ],
};

// ─── Export ─────────────────────────────────────────────────────────────

export const LANDING_PAGES: readonly LandingPage[] = [
  safeSidewalks,
  sidewalkRepair,
  driverepl,
  driveExt,
  driveApron,
  rvPads,
  poolDecks,
  stampedPatio,
  commercial,
  drainage,
] as const;

export function landingPageBySlug(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
