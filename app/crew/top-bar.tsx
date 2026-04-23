/**
 * Jobber-mobile header — date on the left, bell + sparkle (AI) icons
 * on the right. Sits above the page's own h1 / greeting block; renders
 * once from the crew layout so every screen gets the same chrome.
 *
 * The bell routes to `/crew/more` for now (notifications live on the
 * More screen in our copy of the app until push is fully live). The
 * sparkle is a placeholder for a future Copilot integration — tap-to-
 * dismiss toast for now so it doesn't feel broken.
 */
import Link from "next/link";

export function CrewTopBar({ today }: { today: Date }) {
  const dayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <header
      className="sticky top-0 z-20 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {dayLabel}
        </p>
        <div className="flex items-center gap-1">
          <Link
            href="/crew/more"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </Link>
          <button
            type="button"
            aria-label="Assistant"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 16l.6 1.7L7.3 18l-1.7.6L5 20l-.6-1.4L2.7 18l1.7-.3z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
