"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { CreateMenu } from "@/components/create-menu";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Jobber-parity dashboard chrome — rebuilt from the April 2026 UI audit.
 *
 * Structure:
 *   ┌─────────────┬─────────────────────────────────────────────────────┐
 *   │  158 px     │                  header ~60 px                       │
 *   │  sidebar    ├─────────────────────────────────────────────────────┤
 *   │             │                                                      │
 *   │  logo       │                                                      │
 *   │  ⊕ Create   │              main content (page-specific)            │
 *   │  ─────      │                                                      │
 *   │  Home       │                                                      │
 *   │  Schedule   │                                                      │
 *   │  ─────      │                                                      │
 *   │  Clients    │                                                      │
 *   │  Requests   │                                                      │
 *   │  Quotes     │                                                      │
 *   │  Jobs       │                                                      │
 *   │  Invoices   │                                                      │
 *   │  Payments   │                                                      │
 *   │  ─────      │                                                      │
 *   │  Marketing  │                                                      │
 *   │  …          │                                                      │
 *   │  ◀ collapse │                                                      │
 *   └─────────────┴─────────────────────────────────────────────────────┘
 *
 *  Dark palette: sidebar `#1A1E22`, main bg `#121619`, cards `#1F252A`.
 *  Light palette falls back to the brand colors — we only need dark parity
 *  since Ronnie runs it in dark mode per the audit screenshots.
 *
 *  Collapse: single chevron button at the bottom shrinks the sidebar to
 *  56 px (icons only). State persisted in localStorage so the choice
 *  survives a reload.
 */

type NavKind = "link" | "divider";
type NavItem =
  | {
      kind: "link";
      href: string;
      label: string;
      icon: React.ReactNode;
      matchPrefix?: boolean;
      hidden?: (role: string) => boolean;
    }
  | { kind: "divider" };

const ICON = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);

const NAV: NavItem[] = [
  {
    kind: "link",
    href: "/dashboard",
    label: "Home",
    icon: ICON("M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"),
  },
  {
    kind: "link",
    href: "/dashboard/schedule",
    label: "Schedule",
    matchPrefix: true,
    icon: ICON(
      "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 11h18M8 3v4M16 3v4",
    ),
  },
  { kind: "divider" },
  {
    kind: "link",
    href: "/dashboard/clients",
    label: "Clients",
    matchPrefix: true,
    icon: ICON("M4 6h16v12H4zM4 10h16M8 6v-2M16 6v-2"),
  },
  {
    kind: "link",
    href: "/dashboard/requests",
    label: "Requests",
    matchPrefix: true,
    icon: ICON("M3 7h18l-3 12a2 2 0 0 1-2 1.5H8a2 2 0 0 1-2-1.5L3 7zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"),
  },
  {
    kind: "link",
    href: "/dashboard/quotes",
    label: "Quotes",
    matchPrefix: true,
    icon: ICON("M7 3h10l4 4v14H3V3h4zM7 3v5h10V3M8 13h8M8 17h5"),
  },
  {
    kind: "link",
    href: "/dashboard/projects",
    label: "Jobs",
    matchPrefix: true,
    icon: ICON("M4 7h16v12H4zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 13h16"),
  },
  {
    kind: "link",
    href: "/dashboard/payments",
    label: "Invoices",
    matchPrefix: true,
    icon: ICON("M3 6h18v12H3zM3 10h18M7 15h3M14 15h3"),
  },
  {
    kind: "link",
    href: "/dashboard/reports",
    label: "Payments",
    matchPrefix: true,
    icon: ICON("M5 11V7a7 7 0 0 1 14 0v4M3 11h18v10H3zM12 15v2"),
  },
  { kind: "divider" },
  {
    kind: "link",
    href: "/dashboard/pipeline",
    label: "Pipeline",
    matchPrefix: true,
    icon: ICON("M3 3h18l-7 8v8l-4 2v-10L3 3z"),
  },
  {
    kind: "link",
    href: "/dashboard/messages",
    label: "Messages",
    matchPrefix: true,
    icon: ICON("M4 5h16v11H7l-3 3V5z"),
  },
  {
    kind: "link",
    href: "/dashboard/workflows",
    label: "Workflows",
    matchPrefix: true,
    icon: ICON("M4 5h5v5H4zM15 5h5v5h-5zM4 14h5v5H4zM15 14h5v5h-5zM9 7.5h6M9 16.5h6M6.5 10v4M17.5 10v4"),
  },
  {
    kind: "link",
    href: "/dashboard/expenses",
    label: "Expenses",
    matchPrefix: true,
    icon: ICON("M3 4h18v4H3zM5 8v12h14V8M10 12h4"),
  },
  {
    kind: "link",
    href: "/dashboard/cash-journal",
    label: "Cash journal",
    matchPrefix: true,
    icon: ICON("M4 6h16M4 12h16M4 18h10"),
  },
  {
    kind: "link",
    href: "/dashboard/activity",
    label: "Activity",
    matchPrefix: true,
    icon: ICON("M3 12h4l3-9 4 18 3-9h4"),
  },
  { kind: "divider" },
  {
    kind: "link",
    href: "/dashboard/settings",
    label: "Settings",
    matchPrefix: true,
    hidden: (role) => role !== "admin",
    icon: ICON(
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 12a7 7 0 0 0-.1-1.2l2.2-1.7-2-3.4-2.6 1a7 7 0 0 0-2-1.2l-.4-2.8h-4l-.4 2.8a7 7 0 0 0-2 1.2l-2.6-1-2 3.4 2.2 1.7A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2.2 1.7 2 3.4 2.6-1a7 7 0 0 0 2 1.2l.4 2.8h4l.4-2.8a7 7 0 0 0 2-1.2l2.6 1 2-3.4-2.2-1.7A7 7 0 0 0 19 12z",
    ),
  },
];

function isActive(pathname: string, item: Extract<NavItem, { kind: "link" }>): boolean {
  if (item.matchPrefix) {
    // Avoid /dashboard prefix capturing every page
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(item.href);
  }
  return pathname === item.href;
}

function NavLinks({
  pathname,
  onNavigate,
  role,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  role: string;
  collapsed: boolean;
}) {
  return (
    <nav className="flex flex-col gap-0.5 px-2 py-3" aria-label="Primary">
      {NAV.map((item, idx) => {
        if (item.kind === "divider") {
          return (
            <div
              key={`d${idx}`}
              role="separator"
              aria-hidden="true"
              className="my-2 h-px bg-neutral-200 dark:bg-jobber-line"
            />
          );
        }
        if (item.hidden?.(role)) return null;
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={`group flex min-h-10 items-center gap-3 rounded-full px-3 py-2 text-[13px] font-medium transition ${
              active
                ? "bg-neutral-200 text-neutral-900 dark:bg-white/10 dark:text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-jobber-text-2 dark:hover:bg-white/5 dark:hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <span
              className={
                active
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-jobber-text-2 group-hover:text-neutral-900 dark:group-hover:text-white"
              }
            >
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
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
  const [collapsed, setCollapsed] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // Persist sidebar collapsed state across reloads.
  useEffect(() => {
    const saved = localStorage.getItem("rc:sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("rc:sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Close on Esc + trap focus inside the drawer while it's open.
  useEffect(() => {
    if (!drawerOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusablesIn(root: HTMLElement): HTMLElement[] {
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"]), input, select, textarea',
        ),
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

    const items = drawerRef.current ? focusablesIn(drawerRef.current) : [];
    items[0]?.focus();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const sidebarWidth = collapsed ? "w-16" : "w-40";
  const mainPadding = collapsed ? "lg:pl-16" : "lg:pl-40";

  const SidebarBody = (
    <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-jobber-nav dark:text-white">
      {/* Logo / brand */}
      <div className="flex h-14 items-center gap-2 px-3">
        <Link
          href="/dashboard"
          aria-label="Rose Concrete home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-extrabold text-white shadow-sm"
          style={{ background: "#8FBF4A" }}
          onClick={() => setDrawerOpen(false)}
        >
          R
        </Link>
        {!collapsed && (
          <span className="truncate text-sm font-bold text-neutral-900 dark:text-white">
            {tenantName ?? "Rose Concrete"}
          </span>
        )}
      </div>

      {/* Create button */}
      <div className="px-3 pb-2">
        {collapsed ? (
          <Link
            href="/dashboard/quotes/quick"
            title="Quick quote"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-jobber-green text-neutral-900 shadow-sm hover:brightness-110"
          >
            <span className="text-xl leading-none">+</span>
          </Link>
        ) : (
          <div className="[&_>*]:w-full">
            <CreateMenu />
          </div>
        )}
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto">
        <NavLinks
          pathname={pathname}
          onNavigate={() => setDrawerOpen(false)}
          role={user.role}
          collapsed={collapsed}
        />
      </div>

      {/* User + collapse footer */}
      <div className="border-t border-neutral-200 dark:border-jobber-line">
        {!collapsed && (
          <div className="px-3 py-2 text-[11px] text-neutral-500 dark:text-jobber-text-2">
            <div className="truncate font-medium text-neutral-800 dark:text-white">
              {user.full_name ?? user.email}
            </div>
            <div className="truncate">{user.role}</div>
          </div>
        )}
        <div className={`flex ${collapsed ? "flex-col" : "items-center gap-2"} px-3 py-2`}>
          {!collapsed && (
            <div className="flex-1">
              <SignOutButton />
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden h-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-jobber-text-2 dark:hover:bg-white/5 lg:inline-flex ${
              collapsed ? "mx-auto w-10" : "w-8"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-jobber-bg">
      {/* Desktop fixed sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-neutral-200 dark:border-jobber-line lg:block ${sidebarWidth} transition-[width] duration-150`}
      >
        {SidebarBody}
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
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-neutral-200 shadow-xl dark:border-jobber-line lg:hidden"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-2 rounded-md p-2 text-neutral-500 hover:bg-neutral-100 dark:text-jobber-text-2 dark:hover:bg-white/5"
            >
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </button>
            {SidebarBody}
          </aside>
        </>
      )}

      {/* Main column */}
      <div className={mainPadding}>
        {/* Top bar — sticky */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-jobber-line dark:bg-jobber-bg/95 lg:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-jobber-text-2 dark:hover:bg-white/5 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
            </svg>
          </button>

          {/* Left: tenant name (Jobber shows account name in header left) */}
          <span className="hidden truncate text-xs text-neutral-500 dark:text-jobber-text-2 md:inline">
            {tenantName ?? "Rose Concrete"}
          </span>

          <div className="flex-1" />

          <GlobalSearch />
          <div className="hidden md:block">
            <CreateMenu />
          </div>
          {notificationBell}
          <ThemeToggle initial={theme} />
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
