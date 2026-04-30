import {
  GOOGLE_REVIEW_URL,
  LICENSE,
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";

/**
 * Top utility bar — thin navy strip above the main marketing header.
 *
 * Desktop: license · phone (click-to-call) on the left, Google Reviews
 * link on the right.
 * Mobile (<sm): phone-number link only — license + reviews collapse to
 * keep the strip readable.
 *
 * Not sticky on purpose. Sits at the top of the page; the main
 * <MarketingHeader> below it takes the sticky slot. Server-rendered,
 * no client JS — fastest LCP, no layout shift.
 *
 * Replaces the previous `StickyTrustBar` (sticky, scroll-aware) per
 * the 2026-04-30 marketing-batch rebuild.
 */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.45-1.55 4.25-5.27 4.25-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.43C16.86 4.04 14.71 3 12.18 3 6.99 3 2.85 7.14 2.85 12.42S6.99 21.85 12.18 21.85c7.03 0 9.34-4.93 9.34-7.42 0-.5-.05-.88-.17-1.33z" />
    </svg>
  );
}

export function MarketingUtilityBar() {
  return (
    <div className="bg-brand-900 text-cream-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5 text-xs sm:px-6">
        {/* Left side: license + phone on desktop, phone only on mobile. */}
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

        {/* Right side: Google Reviews. Hidden on the smallest phones. */}
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Read our Google Reviews"
          className="hidden items-center gap-1.5 font-semibold text-cream-50/90 transition hover:text-accent-300 sm:inline-flex"
        >
          <GoogleIcon className="h-3.5 w-3.5" />
          <span>Google Reviews</span>
        </a>
      </div>
    </div>
  );
}
