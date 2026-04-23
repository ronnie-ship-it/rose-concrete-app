"use client";

/**
 * Jobber-mobile-parity bottom navigation. Five tabs (Home / Schedule /
 * Timesheet / Search / More) pinned to the viewport bottom, always
 * visible. Active tab = primary green icon + label + thin top border.
 * Tap target ≥ 56 px tall (Android guideline + iOS 44-pt minimum).
 *
 * Active tab is determined from the pathname, not URL params, so the
 * tab highlight survives query filters.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: React.ReactNode;
};

const ICON = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6"
    aria-hidden="true"
  >
    {/* dangerouslySetInnerHTML is overkill for a tree of paths; pass JSX */}
    <path d={path} />
  </svg>
);

const TABS: Tab[] = [
  {
    href: "/crew",
    label: "Home",
    match: (p) => p === "/crew",
    // House / home icon
    icon: ICON("M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"),
  },
  {
    href: "/crew/schedule",
    label: "Schedule",
    match: (p) => p.startsWith("/crew/schedule") || p.startsWith("/crew/visits"),
    // Calendar icon
    icon: ICON(
      "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 11h18M8 3v4M16 3v4",
    ),
  },
  {
    href: "/crew/timesheet",
    label: "Timesheet",
    match: (p) => p.startsWith("/crew/timesheet"),
    // Clock icon
    icon: ICON(
      "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    ),
  },
  {
    href: "/crew/search",
    label: "Search",
    match: (p) => p.startsWith("/crew/search"),
    // Magnifier
    icon: ICON("M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"),
  },
  {
    href: "/crew/more",
    label: "More",
    match: (p) =>
      p.startsWith("/crew/more") ||
      p.startsWith("/crew/upload") ||
      p.startsWith("/crew/form"),
    // Three horizontal dots
    icon: ICON("M5 12h.01M12 12h.01M19 12h.01"),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/crew";
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? "text-[#4A7C59]"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {/* Active indicator — thin bar along the top edge */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-[#4A7C59]"
                  />
                )}
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
