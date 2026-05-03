"use client";

/**
 * TextField — the one shared input component for every Jobber-mobile-
 * style Create form, starting with /crew/create/client. Exists to fix
 * Phase 1.5 Bug 2 (invisible typing) at the architectural level —
 * once every input flows through this component, the iOS Safari
 * caret/zoom/text-fill bugs are a one-time fix instead of a
 * whack-a-mole across pages.
 *
 * The four properties that make Bug 2 stop happening (per the brief
 * §99–119 and confirmed by Day 2 §A):
 *
 *   1. font-size: 16px minimum. Anything smaller triggers iOS Safari's
 *      auto-zoom on focus, which then scrolls the input partially
 *      off-screen and makes it look like the user can't see what
 *      they're typing. We use the inline style so it wins over any
 *      Tailwind text-sm cascade.
 *
 *   2. caret-color: navy. The brief asks for `var(--brand-900)`. That
 *      token doesn't exist in globals.css and the user explicitly
 *      said NOT to change tokens, so we use the literal hex (#1B2A4A,
 *      same value as the existing `--brand`). Visible cursor on a
 *      white surface.
 *
 *   3. -webkit-text-fill-color: near-black. iOS Safari has a long-
 *      standing bug where typed text reads as gray/transparent even
 *      when `color` is set; the WebKit-only fill-color property
 *      overrides it. The brief calls for `var(--text)`; we use the
 *      literal #111827 (matches `body { color: ... }` in globals.css).
 *
 *   4. min-height: 48px. Touch-target rule — anything smaller is hard
 *      to tap on a phone.
 *
 * Layout: label above the input, optional error message below in red.
 *
 * Out of scope for PR-A1: the brief lists `<AddressField>` (autocomplete
 * specialization) as a NEW component. The existing
 * `<AddressAutocomplete>` already covers Google Places autocomplete,
 * and the user said the PR-A1 scope is "just the two new components +
 * the Add Client page" — so we keep using <AddressAutocomplete> on
 * Add Client and defer the AddressField wrapper to PR-Y.
 */
import { useId } from "react";

type Props = {
  /** Field label rendered above the input. */
  label: string;
  /** Form input name. */
  name: string;
  /** HTML input type — defaults to "text". Pass "email" / "tel" /
   *  "password" / "number" as needed. */
  type?: string;
  /** iOS keyboard hint — defaults to a sensible value based on
   *  `type`. Pass explicitly to override. */
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** Browser autocomplete hint. */
  autoComplete?: string;
  /** Defaults to false. */
  required?: boolean;
  /** Defaults to false — set true for the field that should grab
   *  focus when its row first appears (e.g. tap-to-reveal). */
  autoFocus?: boolean;
  placeholder?: string;
  defaultValue?: string;
  /** Optional inline error message rendered below the input in red. */
  error?: string | null;
};

const DEFAULT_INPUT_MODE: Record<
  string,
  React.HTMLAttributes<HTMLInputElement>["inputMode"]
> = {
  email: "email",
  tel: "tel",
  number: "decimal",
};

export function TextField({
  label,
  name,
  type = "text",
  inputMode,
  autoComplete,
  required = false,
  autoFocus = false,
  placeholder,
  defaultValue,
  error,
}: Props) {
  const id = useId();
  const resolvedInputMode = inputMode ?? DEFAULT_INPUT_MODE[type] ?? "text";

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={resolvedInputMode}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        defaultValue={defaultValue}
        // The four Bug-2 fixes inline so they win over any cascade.
        // Don't move these into a className — Tailwind's text-sm
        // resolves to 14 px, which would re-introduce the iOS auto-
        // zoom regression.
        style={{
          fontSize: 16,
          minHeight: 48,
          // TODO(PR-G): replace #1B2A4A with var(--brand-900) once Phase 2 tokens ship.
          caretColor: "#1B2A4A",
          // TODO(PR-G): replace #111827 with var(--text) once Phase 2 tokens ship.
          WebkitTextFillColor: "#111827",
        }}
        className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * RevealRow — a tappable text-link row that swaps to a real <TextField>
 * when the user opts in. Implements the Day 2 §C.1 "collapsed-until-
 * tapped" pattern: optional fields stay invisible until the user
 * actively asks to fill them, so the form looks short.
 *
 * Co-located with TextField because they're a primitive pair: a row
 * is either a TextField (revealed) or a RevealRow (collapsed). One
 * import covers both. The user's PR-A1 scope said "two new components
 * + the Add Client page"; this is a sibling export inside the
 * TextField file, not a third file.
 *
 * Visual: leading icon (monochrome), bold green-ish text, small
 * chevron on the right. The icon is passed by the caller as JSX so
 * we don't pull a new icon dependency in PR-A1.
 */
export function RevealRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minHeight: 48 }}
      className="flex w-full items-center gap-3 rounded-md border border-transparent px-1 py-2 text-left transition active:bg-neutral-50 dark:active:bg-neutral-800"
    >
      {/* TODO(PR-G): replace #1B2A4A with var(--brand-900) once Phase 2 tokens ship. */}
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-[#1B2A4A] dark:text-neutral-300"
      >
        {icon}
      </span>
      {/* TODO(PR-G): replace #1B2A4A with var(--brand-900) once Phase 2 tokens ship. */}
      <span className="flex-1 text-base font-bold text-[#1B2A4A] dark:text-neutral-100">
        {label}
      </span>
      <span aria-hidden="true" className="text-neutral-300">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
