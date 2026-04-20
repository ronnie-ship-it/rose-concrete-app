import Link from "next/link";
import { buttonClassNames } from "@/components/ui/button";
import {
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
  PRIMARY_NAV,
  SHORT_NAME,
} from "@/lib/marketing/brand";

/**
 * Sticky marketing header.
 *
 * Layout, mobile-first:
 *   [Logo]                              [📞 (619) 537-9408]
 *
 * Layout, ≥md:
 *   [Logo]   Services  Service Areas  About  Contact   [📞 (619) 537-9408]
 *
 * Design intent: every visitor on every page can see the phone number
 * without scrolling. The button is the visual heaviest thing on the
 * page after the logo so eye flow lands there first. Aligned to the
 * brand teal accent so it pops against navy without inviting the user
 * to mistake it for a generic "next" CTA.
 *
 * No client JS — server-rendered for fastest LCP.
 */

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-brand-700 transition hover:text-brand-900"
        >
          {/* Wordmark only — logo image will swap in once Ronnie supplies a clean SVG. */}
          <span className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {SHORT_NAME}
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile, the mobile call bar carries the load. */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 md:flex"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-brand-700 transition hover:text-accent-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Click-to-call — always visible. Sized large enough on mobile to be
            a comfortable one-thumb tap target (44pt+). Renders as a real
            <a> with button styling so we don't nest interactive elements. */}
        <a
          href={PHONE_TEL_HREF}
          data-cta-placement="header"
          aria-label={`Call ${PHONE_DISPLAY}`}
          className={buttonClassNames({
            variant: "accent",
            size: "lg",
            className: "h-11 shrink-0 px-3 text-sm sm:h-12 sm:px-5 sm:text-base",
          })}
        >
          <PhoneIcon className="h-5 w-5" />
          <span className="hidden sm:inline">{PHONE_DISPLAY}</span>
          <span className="sm:hidden">Call</span>
        </a>
      </div>
    </header>
  );
}
