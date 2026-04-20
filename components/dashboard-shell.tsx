"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { CreateMenu } from "@/components/create-menu";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Jobber-inspired dashboard chrome:
 *   - Fixed left sidebar on desktop (≥lg)
 *   - Slide-out drawer on mobile
 *   - Icon + label nav items, subtle active-state highlight
 *   - Sticky top bar shows page title slot + user chip
 *
 * Brand palette (brand-*) is kept — Jobber uses green, Rose is red. The
 * layout, not the color, is what makes it feel Jobber-y: left nav, white
 * content cards on a soft gray bg, generous spacing, no heavy shadows.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix?: boolean;
};

// Simple inline SVGs — no icon library dep, small bundle.
const icons = {
  home: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.7 2.3a1 1 0 0 0-1.4 0l-7 7A1 1 0 0 0 3 11h1v6a1 1 0 0 0 1 1h3v-4a2 2 0 1 1 4 0v4h3a1 1 0 0 0 1-1v-6h1a1 1 0 0 0 .7-1.7l-7-7z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M5 3a1 1 0 0 1 1 1v1h8V4a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1zm-2 6v8h14V9H3z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.8 0-5 1.8-5 4v1h10v-1c0-2.2-2.2-4-5-4zm6.5-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm4.5 6.5c0-1.9-1.6-3.5-4.1-3.5a5 5 0 0 0-1.6.3A6.3 6.3 0 0 1 14 15v1h4v-.5z" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M8 3a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2V5a2 2 0 0 0-2-2H8zm4 3H8V5h4v1z" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M4 3a2 2 0 0 1 2-2h5l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3zm8 0v4h4l-4-4z" />
    </svg>
  ),
  dollar: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 13.9V16H9v-1.1a4 4 0 0 1-3-3.5l2-.2c.1 1.1.9 1.8 2 1.8s2-.4 2-1.4c0-1-.9-1.3-2.6-1.7-2-.5-3.3-1.3-3.3-3 0-1.6 1.2-2.7 2.9-3V3h2v1c1.6.3 2.7 1.4 2.9 3l-2 .2c-.1-.9-.7-1.4-1.9-1.4S9 6.1 9 7c0 .8.8 1.1 2.4 1.5 2 .5 3.6 1.2 3.6 3.2 0 1.7-1.3 2.9-3 3.2z" />
    </svg>
  ),
  cog: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M11.5 2a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v.6a6.6 6.6 0 0 0-1.8.8l-.4-.4a1 1 0 0 0-1.4 0l-.8.7a1 1 0 0 0 0 1.5l.4.4a6.6 6.6 0 0 0-.8 1.8H3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h.6c.2.7.4 1.3.8 1.8l-.4.4a1 1 0 0 0 0 1.5l.7.7a1 1 0 0 0 1.5 0l.4-.4a6.6 6.6 0 0 0 1.8.8v.6a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-.6a6.6 6.6 0 0 0 1.8-.8l.4.4a1 1 0 0 0 1.5 0l.7-.7a1 1 0 0 0 0-1.5l-.4-.4a6.6 6.6 0 0 0 .8-1.8H17a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-.6a6.6 6.6 0 0 0-.8-1.8l.4-.4a1 1 0 0 0 0-1.5l-.7-.7a1 1 0 0 0-1.5 0l-.4.4a6.6 6.6 0 0 0-1.8-.8V2zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        clipRule="evenodd"
      />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
      <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: icons.home },
  { href: "/dashboard/schedule", label: "Schedule", icon: icons.calendar, matchPrefix: true },
  { href: "/dashboard/requests", label: "Requests", icon: icons.users, matchPrefix: true },
  { href: "/dashboard/clients", label: "Clients", icon: icons.users, matchPrefix: true },
  { href: "/dashboard/projects", label: "Jobs", icon: icons.briefcase, matchPrefix: true },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: icons.briefcase, matchPrefix: true },
  { href: "/dashboard/workflows", label: "Workflows", icon: icons.document, matchPrefix: true },
  { href: "/dashboard/quotes", label: "Quotes", icon: icons.document, matchPrefix: true },
  { href: "/dashboard/messages", label: "Messages", icon: icons.document, matchPrefix: true },
  { href: "/dashboard/tasks", label: "Tasks", icon: icons.document, matchPrefix: true },
  { href: "/dashboard/concrete-order", label: "Concrete order", icon: icons.briefcase, matchPrefix: true },
  { href: "/dashboard/change-orders", label: "Change orders", icon: icons.document, matchPrefix: true },
  { href: "/dashboard/payments", label: "Payments", icon: icons.dollar, matchPrefix: true },
  { href: "/dashboard/expenses", label: "Expenses", icon: icons.dollar, matchPrefix: true },
  { href: "/dashboard/cash-journal", label: "Cash journal", icon: icons.dollar, matchPrefix: true },
  { href: "/dashboard/reports", label: "Reports", icon: icons.document, matchPrefix: true },
  { href: "/dashboard/activity", label: "Activity", icon: icons.document, matchPrefix: true },
];

const adminItems: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: icons.cog, matchPrefix: true },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.href);
  return pathname === item.href;
}

function NavLinks({
  pathname,
  onNavigate,
  role,
}: {
  pathname: string;
  onNavigate?: () => void;
  role: string;
}) {
  const items = role === "admin" ? [...navItems, ...adminItems] : navItems;
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-brand-50 text-brand-700 dark:bg-brand-700 dark:text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-brand-700 dark:hover:text-white"
            }`}
          >
            <span
              className={
                active
                  ? "text-brand-600 dark:text-white"
                  : "text-neutral-400 dark:text-neutral-400"
              }
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  user,
  children,
  notificationBell,
  theme = "light",
  tenantName = null,
}: {
  user: { email: string; role: string; full_name: string | null };
  children: React.ReactNode;
  notificationBell?: React.ReactNode;
  theme?: "light" | "dark";
  /** Rendered next to the brand name in the sidebar so it's obvious
   *  which tenant/workspace the user is signed into. Falls back to
   *  "Rose Concrete" if not set. */
  tenantName?: string | null;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close on Esc + trap focus inside the drawer while it's open. Matches the
  // WAI-ARIA dialog pattern — user expects Esc to dismiss, and tabbing
  // shouldn't escape into the (hidden behind overlay) main content.
  useEffect(() => {
    if (!drawerOpen) return;

    // Scroll-lock the body so the overlay actually feels modal on mobile.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusablesIn(root: HTMLElement): HTMLElement[] {
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"]), input, select, textarea'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const items = focusablesIn(drawerRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Focus the first focusable inside the drawer on open.
    const items = drawerRef.current ? focusablesIn(drawerRef.current) : [];
    items[0]?.focus();

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  // Close drawer when the route changes (mobile nav tap).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const Sidebar = (
    <div className="flex h-full flex-col bg-white dark:bg-brand-800 dark:text-neutral-100">
      <div className="flex h-14 items-center gap-2 border-b border-neutral-200 px-5 dark:border-brand-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Rose Concrete"
          className="h-7 w-7 rounded-sm object-contain"
        />
        <Link
          href="/dashboard"
          className="text-base font-bold text-brand-700 dark:text-white"
          onClick={() => setDrawerOpen(false)}
        >
          {tenantName ?? "Rose Concrete"}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks
          pathname={pathname}
          onNavigate={() => setDrawerOpen(false)}
          role={user.role}
        />
      </div>
      <div className="border-t border-neutral-200 p-3 dark:border-brand-700">
        <div className="mb-2 px-2 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="truncate font-medium text-neutral-700 dark:text-neutral-200">
            {user.full_name ?? user.email}
          </div>
          <div className="truncate">{user.email} · {user.role}</div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-brand-900">
      {/* Desktop fixed sidebar */}
      <aside className="dashboard-shell-sidebar fixed inset-y-0 left-0 hidden w-60 border-r border-neutral-200 dark:border-brand-700 lg:block">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-neutral-900/40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-neutral-200 shadow-xl lg:hidden"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
            >
              {icons.close}
            </button>
            {Sidebar}
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="lg:pl-60">
        {/* Top bar — sticky, houses the mobile menu button */}
        <header className="dashboard-shell-header sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-brand-700 dark:bg-brand-800/90 lg:px-8">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="dashboard-drawer"
          >
            {icons.menu}
          </button>
          <GlobalSearch />
          <CreateMenu />
          {notificationBell}
          <ThemeToggle initial={theme} />
          <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
            {user.email}
          </span>
        </header>

        <main className="dashboard-shell-main mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
