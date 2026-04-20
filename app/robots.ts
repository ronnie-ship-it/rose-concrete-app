import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/marketing/schema";

/**
 * robots.txt — served at sandiegoconcrete.ai/robots.txt.
 *
 * Disallows the operations app routes (/dashboard, /crew, /login, etc.)
 * because they're auth-gated and shouldn't be crawled. The marketing
 * surfaces are all crawlable. Sitemap pointer at the bottom.
 *
 * Note: the host-based middleware redirects these paths from the
 * marketing domain to app.* anyway, so this is belt-and-suspenders.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/login",
          "/dashboard",
          "/crew",
          "/q/",
          "/pay/",
          "/change-order/",
          "/hub/",
          "/embed/",
          "/book",
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
