import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { MobileCallBar } from "@/components/marketing/mobile-call-bar";
import { StickyTrustBar } from "@/components/marketing/trust-bar";
import { GtmHeadScript, GtmNoScript } from "@/components/marketing/gtm";
import { PhoneClickTracker } from "@/components/marketing/phone-click-tracker";
import { SITE_ORIGIN } from "@/lib/marketing/schema";

/**
 * Marketing-site layout.
 *
 * Wraps every page under app/(marketing)/* — home, services, landing,
 * service-areas, about, contact. Three persistent surfaces:
 *
 *   <MarketingHeader>      sticky top, big click-to-call
 *   <main>{children}</main>
 *   <MarketingFooter>      trust signals + service-area link block
 *   <MobileCallBar>        sticky bottom, mobile only
 *
 * The `pb-20 md:pb-0` on <main> keeps page content out from under the
 * mobile call bar (which is `position: fixed` and ~56px + safe-area).
 *
 * Default metadata cascades to every (marketing) page that doesn't
 * override:
 *   - `metadataBase` lets pages use relative OG image URLs.
 *   - `title.template` adds "| Rose Concrete" to per-page titles.
 *     Pages that want the full brand title verbatim use
 *     `title: { absolute: '...' }` to opt out of the template.
 *   - OG / Twitter defaults so social shares look right even on a
 *     page that forgets to set its own.
 *   - `robots: index, follow` because every marketing surface is
 *     crawlable. (Operations routes are blocked by app/robots.ts.)
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Rose Concrete — San Diego Concrete Contractor",
    template: "%s | Rose Concrete",
  },
  description:
    "Family-run, veteran-owned concrete contractor serving San Diego County. Driveways, patios, sidewalks, and the Safe Sidewalks Program. CA License #1130763, fully insured.",
  applicationName: "Rose Concrete",
  authors: [{ name: "Rose Concrete and Development" }],
  keywords: [
    "concrete contractor san diego",
    "san diego concrete",
    "concrete driveway san diego",
    "concrete patio san diego",
    "sidewalk repair san diego",
    "safe sidewalks program",
    "stamped concrete san diego",
    "exposed aggregate san diego",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Rose Concrete",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Rose Concrete — San Diego Concrete Contractor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-default.png"],
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-brand-900">
      <GtmHeadScript />
      <GtmNoScript />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-brand-900 focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <StickyTrustBar />
      <main id="main" className="pb-20 md:pb-0">
        {children}
      </main>
      <MarketingFooter />
      <MobileCallBar />
      <PhoneClickTracker />
    </div>
  );
}
