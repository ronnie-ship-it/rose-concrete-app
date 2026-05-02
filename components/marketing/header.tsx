"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { buttonClassNames } from "@/components/ui/button";
import { PRIMARY_NAV } from "@/lib/marketing/brand";
import { CORE_SERVICES } from "@/lib/marketing/services";
import { cn } from "@/lib/utils";

/**
 * Sticky marketing header — sits below the <MarketingUtilityBar>.
 *
 * Desktop (md+):
 *   [Logo + wordmark]   Home · Services▾ · Projects · About · Contact   [Get a Free Estimate]
 *   "Services" opens a hover/focus dropdown listing CORE_SERVICES.
 *
 * Mobile (<md):
 *   [Logo]                                        [Free Estimate] [☰]
 *   Hamburger toggles a drop-down panel with the same nav, plus an
 *   expandable Services accordion.
 *
 * Client component because both the hamburger + the Services dropdown
 * track open state. Stays small — handful of useState hooks, no UI
 * library, no animation deps.
 */

const SERVICES_SUBMENU = CORE_SERVICES.map((s) => ({
  label: s.name,
  href: `/services/${s.slug}`,
}));

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  // Close the mobile menu whenever the route changes (clicking a link
  // inside the menu navigates without unmounting the layout, so the
  // open state would otherwise persist across pages).
  useEffect(() => {
    setMenuOpen(false);
    setMobileServicesOpen(false);
  }, [pathname]);

  // Esc closes the open mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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

        {/* Desktop nav — hidden on mobile. Pure-CSS Services dropdown
            (group-hover + focus-within), no extra state. */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 md:flex lg:gap-7"
        >
          {PRIMARY_NAV.map((item) =>
            item.label === "Services" ? (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className="flex items-center gap-1 text-sm font-semibold text-brand-700 transition hover:text-accent-600 group-focus-within:text-accent-600"
                  aria-haspopup="menu"
                >
                  {item.label}
                  <span aria-hidden="true" className="text-xs">
                    ▾
                  </span>
                </Link>
                <div
                  role="menu"
                  className="invisible absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 rounded-xl border border-brand-100 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  <ul className="grid gap-0.5">
                    {SERVICES_SUBMENU.map((s) => (
                      <li key={s.href} role="none">
                        <Link
                          href={s.href}
                          role="menuitem"
                          className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-cream-50 hover:text-accent-700"
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-brand-700 transition hover:text-accent-600"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/* Right side: CTA (always visible) + hamburger (mobile only). */}
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#quote"
            data-cta-placement="header"
            className={buttonClassNames({
              variant: "accent",
              size: "lg",
              className: "h-11 px-3 text-sm sm:h-12 sm:px-5 sm:text-base",
            })}
          >
            <span className="hidden sm:inline">Get a Free Estimate</span>
            <span className="sm:hidden">Free Estimate</span>
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-brand-100 text-brand-800 transition hover:bg-cream-50 md:hidden"
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>

      {/* Mobile drop-down menu. Renders inside the same sticky <header>
          so it slides down attached to it. Hidden on md+. */}
      <div
        id={menuId}
        hidden={!menuOpen}
        className="border-t border-brand-100 bg-white md:hidden"
      >
        <nav aria-label="Mobile primary" className="px-4 py-3 sm:px-6">
          <ul className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) =>
              item.label === "Services" ? (
                <li key={item.href}>
                  <div className="flex items-stretch">
                    <Link
                      href={item.href}
                      className="flex-1 rounded-lg px-3 py-3 text-base font-semibold text-brand-800 hover:bg-cream-50"
                    >
                      Services
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMobileServicesOpen((v) => !v)}
                      aria-expanded={mobileServicesOpen}
                      aria-label={
                        mobileServicesOpen
                          ? "Hide service list"
                          : "Show service list"
                      }
                      className="ml-1 inline-flex w-11 items-center justify-center rounded-lg text-brand-700 hover:bg-cream-50"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "transition-transform",
                          mobileServicesOpen && "rotate-180",
                        )}
                      >
                        ▾
                      </span>
                    </button>
                  </div>
                  {mobileServicesOpen && (
                    <ul className="mt-1 ml-4 flex flex-col gap-0.5 border-l border-brand-100 pl-3">
                      {SERVICES_SUBMENU.map((s) => (
                        <li key={s.href}>
                          <Link
                            href={s.href}
                            className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-cream-50 hover:text-accent-700"
                          >
                            {s.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-3 text-base font-semibold text-brand-800 hover:bg-cream-50"
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
            <li className="mt-2">
              <a
                href="#quote"
                onClick={() => setMenuOpen(false)}
                className={buttonClassNames({
                  variant: "accent",
                  size: "lg",
                  className: "w-full justify-center",
                })}
              >
                Get a Free Estimate
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
