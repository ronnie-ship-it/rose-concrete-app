import Image from "next/image";
import Link from "next/link";
import { buttonClassNames } from "@/components/ui/button";
import { PRIMARY_NAV } from "@/lib/marketing/brand";

/**
 * Sticky marketing header — sits below the <MarketingUtilityBar>.
 *
 * Desktop layout:
 *   [Logo + "Rose Concrete & Development"]   Services · About · Contact   [Get a Free Estimate]
 *
 * Mobile layout (<sm):
 *   [Logo]                                                                 [Free Estimate]
 *
 * The phone number lives in the utility bar above (and the sticky
 * <MobileCallBar> at screen-bottom on mobile), so the header itself
 * only owns brand + nav + the form CTA. White background contrasts
 * with the navy utility strip above.
 *
 * Server-rendered, no client JS — fastest LCP. The "Projects" nav
 * item is intentionally absent until the Recent Projects gallery
 * comes back online (photos pending).
 */

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
        {/* Brand: logo + wordmark. Wordmark hides below sm. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-brand-900 transition hover:text-brand-700"
          aria-label="Rose Concrete and Development — Home"
        >
          <Image
            src="/images/logo.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-9 w-9 sm:h-10 sm:w-10"
          />
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline sm:text-xl">
            Rose Concrete &amp; Development
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile. */}
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

        {/* Primary CTA — scrolls to the #quote form on the homepage and
            other marketing pages, or follows /contact on pages that
            don't host one. We use #quote here so the home-page hero
            button + this header CTA always agree. */}
        <a
          href="#quote"
          data-cta-placement="header"
          className={buttonClassNames({
            variant: "accent",
            size: "lg",
            className: "h-11 shrink-0 px-3 text-sm sm:h-12 sm:px-5 sm:text-base",
          })}
        >
          <span className="hidden sm:inline">Get a Free Estimate</span>
          <span className="sm:hidden">Free Estimate</span>
        </a>
      </div>
    </header>
  );
}
