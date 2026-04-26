/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // crew photo uploads
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  /**
   * Old Duda → new Next.js URL preservation.
   *
   * Stakes: 116k Google Search impressions / 618 clicks per quarter on
   * the old Duda site. Top query "concrete contractors san diego" is
   * the high-intent ranking we cannot afford to lose during the deploy.
   *
   * All 66 redirects below are derived from
   * `Rose Concrete/duda-site-content/SITEMAP_URLS.txt` and documented
   * bucket-by-bucket in `URL_MIGRATION_PLAN.md` at the project root.
   *
   * `permanent: true` = HTTP 308. Tells Google "this page moved
   * canonically — transfer the link equity." Use 307 (`permanent:
   * false`) only for temporary moves.
   *
   * Evaluation order: Next.js evaluates redirects BEFORE middleware
   * (per docs), so old paths short-circuit cleanly without the host-
   * routing middleware seeing them. That's important — middleware
   * would otherwise bounce unknown service-paths to the app
   * subdomain.
   */
  async redirects() {
    return [
      // ─── Bucket 2 — Service detail redirects ────────────────────────
      { source: "/services/concrete-driveway", destination: "/services/driveways", permanent: true },
      { source: "/services/concrete-patio", destination: "/services/patios", permanent: true },
      { source: "/services/concrete-paving", destination: "/services/paving", permanent: true },
      { source: "/services/concrete-paving/concrete-walkways", destination: "/services/walkways-sidewalks", permanent: true },
      { source: "/services/exposed-aggregate-concrete", destination: "/services/exposed-aggregate", permanent: true },
      { source: "/services/decorative-concrete/stamped", destination: "/landing/stamped-concrete-patios-san-diego", permanent: true },
      { source: "/services/safe-sidewalks-program", destination: "/landing/safe-sidewalks-program-san-diego", permanent: true },
      { source: "/services/rv-pads", destination: "/landing/rv-pads-san-diego", permanent: true },
      { source: "/services/concrete-repair", destination: "/landing/sidewalk-repair-san-diego", permanent: true },
      { source: "/services/concrete-slabs", destination: "/services/paving", permanent: true },

      // ─── Bucket 3 — Off-menu service pages ──────────────────────────
      { source: "/services/concrete-bollards", destination: "/landing/commercial-flatwork-san-diego", permanent: true },
      { source: "/services/concrete-footings", destination: "/services/retaining-walls", permanent: true },
      { source: "/services/concrete-foundations", destination: "/services", permanent: true },
      { source: "/services/crawl-space-foundation", destination: "/services", permanent: true },
      // Foundations confirmed off-menu (2026-04-25). All foundation
      // variants land on the services overview rather than implying we
      // have a "next-best foundation page."
      { source: "/services/slab-foundation", destination: "/services", permanent: true },
      { source: "/services/pickleball-courts", destination: "/services", permanent: true },
      { source: "/services/airport-hangars", destination: "/services", permanent: true },

      // ─── Bucket 4 — City-scoped service pages (city in our 12) ──────
      { source: "/concrete-contractor-bonita-ca", destination: "/service-areas/bonita", permanent: true },
      { source: "/concrete-contractors-chula-vista-ca", destination: "/service-areas/chula-vista", permanent: true },
      { source: "/services/clairemont-mesa--ca", destination: "/service-areas/clairemont", permanent: true },
      { source: "/services/coronado--ca", destination: "/service-areas/coronado", permanent: true },
      { source: "/services/north-park--ca", destination: "/service-areas/north-park", permanent: true },
      { source: "/services/solana-beach", destination: "/service-areas/solana-beach", permanent: true },
      { source: "/services/university-city", destination: "/service-areas/university-city", permanent: true },

      // ─── Bucket 4 — City-scoped (city NOT in our 12) ────────────────
      { source: "/lincoln-acres--ca", destination: "/service-areas", permanent: true },
      { source: "/concrete-driveway/serra-mesa-ca", destination: "/services/driveways", permanent: true },
      { source: "/concrete-patio/bankers-hill-ca", destination: "/services/patios", permanent: true },
      // La Jolla added as a 13th service area (2026-04-25 user decision):
      // it stays in scope. Other coastal-adjacent areas use La Jolla as
      // the closest in-scope match.
      { source: "/services/la-jolla--ca", destination: "/service-areas/la-jolla", permanent: true },
      // Far north county OUT of scope (2026-04-25 user decision — too far,
      // traffic eats margins). Encinitas / Del Mar / Carlsbad redirect
      // to Solana Beach (the northernmost city we still serve) so the
      // SEO equity transfers to the closest in-scope page rather than
      // the generic /service-areas index.
      { source: "/services/encinitas", destination: "/service-areas/solana-beach", permanent: true },
      { source: "/services/del-mar", destination: "/service-areas/solana-beach", permanent: true },
      { source: "/services/carlsbad--ca", destination: "/service-areas/solana-beach", permanent: true },
      // Other cities not in our 13 — closest match unclear, send to index.
      { source: "/services/little-italy-ca", destination: "/service-areas", permanent: true },
      { source: "/services/rancho-santa-fe", destination: "/service-areas", permanent: true },
      { source: "/services/carmel-valley", destination: "/service-areas", permanent: true },
      { source: "/services/torrey-hills--ca", destination: "/service-areas", permanent: true },
      { source: "/services/poway--ca", destination: "/service-areas", permanent: true },
      { source: "/services/hillcrest--ca", destination: "/service-areas", permanent: true },

      // ─── Bucket 5 — Old `/service-areas/concrete-contractor-*` ─────
      { source: "/service-areas/concrete-contractor-city-heights-san-diego", destination: "/service-areas/city-heights", permanent: true },
      { source: "/service-areas/concrete-contractor-national-city-ca", destination: "/service-areas/national-city", permanent: true },
      { source: "/service-areas/concrete-contractor-lemon-grove-ca", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-logan-heights-san-diego", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-mid-city-san-diego", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-encanto-san-diego", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-south-park-san-diego", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-golden-hill-san-diego", destination: "/service-areas", permanent: true },
      { source: "/service-areas/kensington-ca-concrete-contractor", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-paradise-hills-san-diego", destination: "/service-areas", permanent: true },
      { source: "/service-areas/concrete-contractor-mission-valley-ca", destination: "/service-areas", permanent: true },

      // ─── Bucket 6 — Blog / question-pages ───────────────────────────
      { source: "/blog", destination: "/", permanent: true },
      { source: "/signs-of-a-settling-concrete-slab", destination: "/services", permanent: true },
      { source: "/planning-pickleball-court-construction-for-year-round-play", destination: "/services", permanent: true },
      { source: "/decorative-concrete-style-and-strength-for-your-property", destination: "/services/decorative-concrete", permanent: true },
      { source: "/do-i-need-a-concrete-bollard-for-my-san-diego-business", destination: "/landing/commercial-flatwork-san-diego", permanent: true },
      { source: "/top-rated-concrete-contractor-san-diego", destination: "/", permanent: true },
      { source: "/who-provides-reliable-commercial-parking-lot-paving-in-san-diego", destination: "/landing/commercial-flatwork-san-diego", permanent: true },
      { source: "/who-handles-sidewalk-repairs-in-san-diego-under-the-safe-sidewalks-program", destination: "/landing/safe-sidewalks-program-san-diego", permanent: true },
      { source: "/who-builds-long-lasting-concrete-patios-in-san-diego", destination: "/services/patios", permanent: true },
      { source: "/who-handles-reliable-sidewalk-repairs-in-san-diego", destination: "/landing/sidewalk-repair-san-diego", permanent: true },
      { source: "/who-offers-quality-and-value-for-stamped-concrete-projects-in-san-diego", destination: "/landing/stamped-concrete-patios-san-diego", permanent: true },
      { source: "/which-concrete-contractor-in-san-diego-shows-up-on-time-and-keeps-your-property-clean", destination: "/", permanent: true },
      { source: "/who-is-the-top-rated-concrete-contractor-in-san-diego-for-driveway-replacements-and-paving", destination: "/landing/driveway-replacement-san-diego", permanent: true },
      { source: "/which-concrete-contractor-in-san-diego-handles-sidewalk-drainage-and-cleaning-the-right-way", destination: "/landing/concrete-drainage-solutions-san-diego", permanent: true },
      { source: "/who-is-the-best-concrete-contractor-in-san-diego-for-safe-sidewalks-program-repairs", destination: "/landing/safe-sidewalks-program-san-diego", permanent: true },
      { source: "/top-concrete-foundation-contractor-in-san-diego-free-estimates", destination: "/", permanent: true },

      // ─── Bucket 7 — Misc utility pages ──────────────────────────────
      { source: "/thank-you", destination: "/", permanent: true },
      { source: "/recommend-businesses", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
