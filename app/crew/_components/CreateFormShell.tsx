"use client";

/**
 * CreateFormShell — the form chrome used by every Jobber-mobile-style
 * "New X" page in the crew app, starting with /crew/create/client.
 *
 * Architectural fix from Phase 1.5 PR-A1 (per the Day 2 mobile audit,
 * docs/refactor/jobber-mobile-ui-audit-day2.md §A and §E):
 *
 *   - There is NO sticky/fixed footer. The Save button is rendered
 *     INLINE as the last child of the form's natural scroll. Removes
 *     the keyboard-overlap class of bug at the architectural level
 *     instead of fighting it with z-index / padding hacks.
 *
 *   - The shell wraps the form chrome ONLY: a sticky header (✕ left,
 *     centered title, optional right slot) plus a scrollable body. It
 *     does NOT render a footer, accept a footer prop, or apply any
 *     `position: sticky | fixed` to the page bottom.
 *
 *   - Body has `padding-bottom: env(safe-area-inset-bottom) + 16px`
 *     so the last row clears the iPhone home-indicator zone.
 *
 *   - A focusin scrollIntoView helper jumps to the focused field
 *     after a short keyboard-settle delay. Useful when the keyboard
 *     hides the focused field (the original Bug 1 symptom under the
 *     old sticky-footer design — kept here as belt-and-suspenders).
 *
 * Children render whatever they want — fields, reveal rows, the
 * inline Save button, a Cancel link. The shell is intentionally
 * thin so each Create page composes its own layout.
 *
 * Out of scope for PR-A1: rolling this out to the other 5 Create
 * forms (task / expense / invoice / quote / job). Those keep using
 * the existing `app/crew/create/chrome.tsx` until PR-Y in Phase 3.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CreateFormShell({
  title,
  rightSlot,
  children,
}: {
  /** Centered header title — e.g. "New client". */
  title: string;
  /** Optional content for the top-right of the header (sparkle icon,
   *  contextual help, etc.). Defaults to an empty 40×40 spacer so the
   *  centered title balances against the ✕ on the left. */
  rightSlot?: React.ReactNode;
  /** The form fields, the inline Save button, the Cancel link — all
   *  rendered inside the scrollable body, in the order the page wants. */
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Hide the global crew bottom-nav + top-bar while a Create form is
  // mounted. The form takes the full viewport so the back button and
  // form chrome don't compete with the global app shell. Restored on
  // unmount so navigating back to /crew leaves the nav intact.
  useEffect(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const header = document.querySelector("header");
    const prevNavDisplay = (nav as HTMLElement | null)?.style.display ?? "";
    const prevHeaderDisplay =
      (header as HTMLElement | null)?.style.display ?? "";
    if (nav) (nav as HTMLElement).style.display = "none";
    if (header) (header as HTMLElement).style.display = "none";
    return () => {
      if (nav) (nav as HTMLElement).style.display = prevNavDisplay;
      if (header) (header as HTMLElement).style.display = prevHeaderDisplay;
    };
  }, []);

  // focusin scrollIntoView — when the user taps a field, wait ~200 ms
  // for the on-screen keyboard to slide up, then center the focused
  // field in the visual viewport. Keeps the cursor visible even when
  // a long form would otherwise hide the active row behind the
  // keyboard.
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.matches("input, textarea, select")) {
        window.setTimeout(() => {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 200);
      }
    };
    document.addEventListener("focusin", handler);
    return () => document.removeEventListener("focusin", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-900">
      {/* Sticky header — only sticky element on the page. The body
          below scrolls inside the remaining space. */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-neutral-100 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {/* TODO(PR-G): replace #1a2332 with var(--text-strong) once Phase 2 tokens ship. */}
        <p className="flex-1 text-center text-base font-extrabold text-[#1a2332] dark:text-white">
          {title}
        </p>
        {/* Right slot keeps the centered title balanced. Defaults to
            an empty 40×40 box so a missing slot doesn't shift the
            title left. */}
        <div className="flex h-10 w-10 items-center justify-center">
          {rightSlot ?? null}
        </div>
      </header>

      {/* Scrollable body. NO sticky footer below it — the page renders
          Save + Cancel as inline children at the bottom of its scroll. */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The inline Save button. Always render this as the last (or
 * second-to-last, before <CancelLink>) child of <CreateFormShell>.
 * Full-width, navy (`--brand` = #1B2A4A), white text. The brief
 * called for `var(--brand-900)` — that token doesn't exist yet in
 * globals.css, and the user explicitly said NOT to change tokens, so
 * the literal hex matches the existing `--brand` value.
 */
export function SaveButton({
  label = "Save",
  pending = false,
  disabled = false,
}: {
  label?: string;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      // TODO(PR-G): replace #1B2A4A with var(--brand-900) once Phase 2 tokens ship.
      style={{ backgroundColor: "#1B2A4A", minHeight: 48 }}
      className="flex w-full items-center justify-center rounded-md px-4 text-base font-bold text-white shadow-sm transition active:opacity-90 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * Centered text-link Cancel that pairs with SaveButton. Optional —
 * pages that want to expose the X header button only can omit this.
 */
export function CancelLink({
  href = "/crew",
  label = "Cancel",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <div className="text-center">
      <Link
        href={href}
        className="text-sm font-bold text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
      >
        {label}
      </Link>
    </div>
  );
}
