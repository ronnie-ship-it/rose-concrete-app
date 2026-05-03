import {
  FACEBOOK_URL,
  GOOGLE_REVIEW_URL,
  INSTAGRAM_URL,
  LICENSE,
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";

/**
 * Top utility bar — thin navy strip above the main marketing header.
 *
 * Desktop: license · phone (click-to-call) on the left, three social
 * icon links on the right (Facebook · Instagram · Google Reviews).
 * Mobile (<sm): phone-number link only on the left, social icons on
 * the right.
 *
 * Icons are hand-rolled inline SVGs — sized consistently at 16px and
 * inheriting `currentColor`. lucide-react doesn't ship brand logos
 * (Lucide is a Feather fork that excludes them by policy), so the
 * three marks live here as small, dependency-free `<svg>` constants.
 *
 * Server-rendered, no client JS.
 */

const ICON_LINK_BASE =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-cream-50/85 transition hover:bg-white/10 hover:text-white";

export function MarketingUtilityBar() {
  return (
    <div className="bg-brand-900 text-cream-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5 text-xs sm:px-6">
        {/* Left: license (desktop only) + phone. */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden font-semibold tracking-wide text-cream-50/80 sm:inline">
            Licensed {LICENSE.replace("CA License ", "")}
          </span>
          <span aria-hidden="true" className="hidden text-cream-50/30 sm:inline">
            ·
          </span>
          <a
            href={PHONE_TEL_HREF}
            className="font-bold text-white transition hover:text-accent-300"
          >
            {PHONE_DISPLAY}
          </a>
        </div>

        {/* Right: social profile icons — same size + spacing for all three. */}
        <div className="flex items-center gap-1">
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Rose Concrete on Facebook"
            className={ICON_LINK_BASE}
          >
            <FacebookIcon />
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Rose Concrete on Instagram"
            className={ICON_LINK_BASE}
          >
            <InstagramIcon />
          </a>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Read our Google Reviews"
            className={ICON_LINK_BASE}
          >
            <GoogleIcon />
          </a>
        </div>
      </div>
    </div>
  );
}

const SVG_BASE = "h-4 w-4";

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={SVG_BASE}
      fill="currentColor"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={SVG_BASE}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={SVG_BASE}
      fill="currentColor"
    >
      <path d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.45-1.55 4.25-5.27 4.25-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.43C16.86 4.04 14.71 3 12.18 3 6.99 3 2.85 7.14 2.85 12.42S6.99 21.85 12.18 21.85c7.03 0 9.34-4.93 9.34-7.42 0-.5-.05-.88-.17-1.33z" />
    </svg>
  );
}
