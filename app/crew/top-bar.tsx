"use client";

/**
 * Jobber-mobile header — page-aware. The header behavior changes
 * depending on which tab the crew member is viewing:
 *
 *   /crew              → small gray date on the left
 *   /crew/schedule     → "April ▼" month dropdown on the left + icons
 *                        (jump-to-today, filters, sparkle) on the right
 *   /crew/search       → centered "Search" title + sparkle right
 *   /crew/more         → centered "More" title + sparkle right
 *   /crew/timesheet    → small "Timesheet" title left
 *   /crew/visits/...   → header is hidden (each visit page renders its
 *                        own back button); we just keep the safe-area
 *                        padding so the page doesn't slip under the
 *                        iOS notch
 *
 * On every page the right side has the bell with a red unread-count
 * badge (clicking goes to /crew/more for now), and the AI sparkle
 * placeholder.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

type CrewTopBarProps = {
  /** Today's date for the Home variant. Server-passed so the SSR'd
   *  HTML matches what the client renders — avoids a hydration flash. */
  today: Date;
  /** Unread notifications count — drives the red badge on the bell. */
  unreadCount?: number;
};

export function CrewTopBar({ today, unreadCount = 0 }: CrewTopBarProps) {
  const pathname = usePathname() ?? "/crew";

  // Hide the header entirely on visit detail screens — they render
  // their own back button so the chrome would just be visual noise.
  if (pathname.startsWith("/crew/visits/")) return <SafeAreaSpacer />;

  let leftSlot: React.ReactNode;
  let rightExtras: React.ReactNode = null;

  if (pathname === "/crew") {
    const dayLabel = today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    leftSlot = (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {dayLabel}
      </p>
    );
  } else if (pathname.startsWith("/crew/schedule")) {
    const monthLabel = today.toLocaleDateString("en-US", { month: "long" });
    leftSlot = (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-base font-extrabold text-[#1a2332] dark:text-white"
      >
        {monthLabel}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    );
    rightExtras = (
      <>
        <IconButton ariaLabel="Jump to today">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4M9 14h6" />
          </svg>
        </IconButton>
        <IconButton ariaLabel="Filters">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h12M4 12h8M4 17h4M18 7l3 3-3 3M14 12l3 3-3 3" />
          </svg>
        </IconButton>
      </>
    );
  } else if (pathname.startsWith("/crew/search")) {
    leftSlot = (
      <p className="flex-1 text-center text-base font-extrabold text-[#1a2332] dark:text-white">
        Search
      </p>
    );
  } else if (pathname.startsWith("/crew/more")) {
    leftSlot = (
      <p className="flex-1 text-center text-base font-extrabold text-[#1a2332] dark:text-white">
        More
      </p>
    );
  } else if (pathname.startsWith("/crew/timesheet")) {
    leftSlot = (
      <p className="text-base font-extrabold text-[#1a2332] dark:text-white">
        Timesheet
      </p>
    );
  } else {
    leftSlot = (
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">
        Rose Concrete
      </p>
    );
  }

  const isCenteredTitle =
    pathname.startsWith("/crew/search") || pathname.startsWith("/crew/more");

  return (
    <header
      className="sticky top-0 z-20 bg-white dark:bg-neutral-900"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
        {/* Centered-title variants need invisible left spacer so the
            title sits truly center against the right-hand icons. */}
        {isCenteredTitle && <span className="w-12" aria-hidden="true" />}

        <div className={isCenteredTitle ? "flex flex-1 items-center justify-center" : "flex-1"}>
          {leftSlot}
        </div>

        <div className="flex items-center gap-1">
          {rightExtras}
          {/* Search + More variants drop the bell — Jobber's screenshots
              show only the sparkle on those pages. */}
          {!isCenteredTitle && (
            <Link
              href="/crew/more"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E0443C] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <IconButton ariaLabel="Assistant">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 16l.6 1.7L7.3 18l-1.7.6L5 20l-.6-1.4L2.7 18l1.7-.3z" />
            </svg>
          </IconButton>
        </div>
      </div>
    </header>
  );
}

function SafeAreaSpacer() {
  return (
    <div
      className="bg-white dark:bg-neutral-900"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      aria-hidden="true"
    />
  );
}

function IconButton({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
    >
      {children}
    </button>
  );
}
