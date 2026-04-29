import type { MetadataRoute } from "next";
import { CORE_SERVICES } from "@/lib/marketing/services";
import { LANDING_PAGES } from "@/lib/marketing/landing-pages";
import { SERVICE_AREA_PAGES } from "@/lib/marketing/service-areas";
import { SITE_ORIGIN } from "@/lib/marketing/schema";

/**
 * Marketing sitemap — generated dynamically from the three content
 * config files so adding a new service / landing / area page also
 * adds it to the sitemap with no extra steps.
 *
 * Excludes the operations app (/dashboard, /crew, /login, etc) — those
 * live on app.sandiegoconcrete.ai and shouldn't be indexed from the
 * marketing host. Vercel serves this at sandiegoconcrete.ai/sitemap.xml.
 */

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Priority weights per the marketing spec:
  //   home                 1.00
  //   safe-sidewalks       0.95
  //   other landing pages  0.90
  //   service detail pages 0.85
  //   service-area pages   0.80
  //   /services index      0.85 (peer to detail pages)
  //   /service-areas index 0.80 (peer to detail pages)
  //   about / contact      0.50
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_ORIGIN}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_ORIGIN}/services`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE_ORIGIN}/service-areas`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/about-us`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_ORIGIN}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_ORIGIN}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/terms-of-service`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = CORE_SERVICES.map((s) => ({
    url: `${SITE_ORIGIN}/services/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  const landingRoutes: MetadataRoute.Sitemap = LANDING_PAGES.map((p) => ({
    url: `${SITE_ORIGIN}/landing/${p.slug}`,
    lastModified: now,
    // Landing pages get refreshed for ad copy more often than service pages.
    changeFrequency: "weekly",
    // Safe Sidewalks Program is the flagship — bump its priority.
    priority: p.slug === "safe-sidewalks-program-san-diego" ? 0.95 : 0.9,
  }));

  const areaRoutes: MetadataRoute.Sitemap = SERVICE_AREA_PAGES.map((a) => ({
    url: `${SITE_ORIGIN}/service-areas/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...serviceRoutes, ...landingRoutes, ...areaRoutes];
}
