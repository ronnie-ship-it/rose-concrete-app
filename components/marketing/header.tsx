"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClassNames } from "@/components/ui/button";
import { PRIMARY_NAV } from "@/lib/marketing/brand";
import { CORE_SERVICES } from "@/lib/marketing/services";
import { cn } from "@/lib/utils";

/**
 * Sticky marketing header — sits below the <MarketingUtilityBar>.
 *
 * Desktop (md+):
 *   [Logo + wordmark]   Home · Services▾ · Projects · About · Contact   [Get a Free Estimate]
 *
 * Mobile (<md):
 *   [Logo]                                        [Free Estimate] [☰]
 *   Hamburger opens a right-side slide-in drawer (translate-x with
 *   ease-in-out, ~250ms) holding the same nav + an expandable Services
 *   submenu. The drawer:
 *     - locks <body> scroll while open
 *     - traps Tab/Shift-Tab focus within the drawer
 *     - auto-closes on Esc, on route change, on backdrop click, and
 *       on resize past the md breakpoint
 *
 * Client component (state for both drawer + Services submenu).
 */

const SERVICES_SUBMENU = CORE_SERVICES.map((s) => ({
  label: s.name,
  href: `/services/${s.slug}`,
}));

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Auto-close on route change.
  useEffect(() => {
    setMenuOpen(false);
    setMobileServicesOpen(false);
  }, [pathname]);

  // Auto-close when the viewport grows past md (drawer is mobile-only).
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    function onChange() {
      if (mql.matches) setMenuOpen(false);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Esc closes; Tab is trapped inside the drawer while open.
  useEffect(() => {
    if (!menuOpen) return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    // Focus the first focusable item when the drawer opens.
    const focusables = drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      // Re-query in case the Services accordion just expanded/collapsed.
      const items = drawer
        ? Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Body-scroll lock while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
          {/* Brand */}
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

          {/* Desktop nav */}
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

          {/* CTA + hamburger trigger */}
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
              ref={triggerRef}
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
      </header>

      {/* Mobile-only drawer, backdrop + slide-in panel.
          Both live outside the sticky <header> so the panel can
          take the full viewport height regardless of header sizing. */}
      <div
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-brand-900/40 transition-opacity duration-200 md:hidden",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        id={menuId}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!menuOpen}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-sm flex-col bg-white shadow-xl transition-transform ease-in-out md:hidden",
          "duration-[250ms]",
          menuOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-wider text-brand-700">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-800 hover:bg-cream-50"
          >
            <CloseIcon />
          </button>
        </div>

        <nav
          aria-label="Mobile primary"
          className="flex-1 overflow-y-auto px-4 py-4"
        >
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
                    <ul className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-brand-100 pl-3">
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
          </ul>
        </nav>

        <div className="border-t border-brand-100 px-4 py-4">
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
        </div>
      </div>
    </>
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
