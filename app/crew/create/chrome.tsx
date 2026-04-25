"use client";

/**
 * Shared chrome for every Jobber-mobile-style "New X" form on crew.
 *
 *   ┌──────────────────────────────────────┐
 *   │  ✕            New thing            ✦│   header
 *   ├──────────────────────────────────────┤
 *   │                                      │
 *   │  ...form sections, separated by      │
 *   │  thin gray spacer rows (#f5f5f5)...  │
 *   │                                      │
 *   ├──────────────────────────────────────┤
 *   │ [   GREEN SAVE BUTTON  ]             │   sticky footer
 *   └──────────────────────────────────────┘
 *
 * - Header: X (close → router.back), bold centered title, sparkle on right
 * - Sticky save button at the bottom — full-width green pill
 * - Hides the global crew bottom-nav so the form takes the whole screen
 * - Pulls a `<style>` that targets the layout's bottom-nav element by
 *   `aria-label="Primary"` and hides it while we're mounted
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CrewCreateChrome({
  title,
  children,
  saveLabel = "Save",
  saveHref,
  secondaryLabel,
  secondaryHref,
  formAction,
}: {
  title: string;
  children: React.ReactNode;
  saveLabel?: string;
  /** Optional: link-style save (when there's no form action). */
  saveHref?: string;
  /** Optional: small green "Save" link below the primary button (used
   *  on quotes/invoices where the primary button is "Review and Send"). */
  secondaryLabel?: string;
  secondaryHref?: string;
  /** Optional: form action — wraps `children` in a `<form>` and the
   *  save button posts to it. */
  formAction?: string | ((formData: FormData) => void | Promise<void>);
}) {
  const router = useRouter();

  // Hide the bottom nav and top bar while a create chrome is mounted.
  useEffect(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const header = document.querySelector("header");
    const prevNavDisplay = (nav as HTMLElement | null)?.style.display ?? "";
    const prevHeaderDisplay = (header as HTMLElement | null)?.style.display ?? "";
    if (nav) (nav as HTMLElement).style.display = "none";
    if (header) (header as HTMLElement).style.display = "none";
    return () => {
      if (nav) (nav as HTMLElement).style.display = prevNavDisplay;
      if (header) (header as HTMLElement).style.display = prevHeaderDisplay;
    };
  }, []);

  const inner = (
    <>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-neutral-100 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 12px)" }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="flex-1 text-center text-base font-extrabold text-[#1a2332] dark:text-white">
          {title}
        </p>
        <button
          type="button"
          aria-label="Assistant"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
          </svg>
        </button>
      </header>

      {/* Body — flex-1 so the sticky save button hugs the bottom */}
      <main
        className="flex-1 space-y-0 pb-32"
        // Each section adds its own bottom spacer; .space-y is 0 so we
        // can use `<SectionSpacer>` with a custom gray bg.
      >
        {children}
      </main>

      {/* Sticky save footer */}
      <footer
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 12px)" }}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center gap-1.5">
          {saveHref ? (
            <Link
              href={saveHref}
              className="flex h-12 w-full items-center justify-center rounded-md bg-[#1A7B40] text-base font-bold text-white active:opacity-90"
            >
              {saveLabel}
            </Link>
          ) : (
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-md bg-[#1A7B40] text-base font-bold text-white active:opacity-90"
            >
              {saveLabel}
            </button>
          )}
          {secondaryLabel &&
            (secondaryHref ? (
              <Link
                href={secondaryHref}
                className="text-sm font-bold text-[#1A7B40]"
              >
                {secondaryLabel}
              </Link>
            ) : (
              <button
                type="submit"
                name="action"
                value="save_draft"
                className="text-sm font-bold text-[#1A7B40]"
              >
                {secondaryLabel}
              </button>
            ))}
        </div>
      </footer>
    </>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-900">
      {formAction ? <form action={formAction}>{inner}</form> : inner}
    </div>
  );
}

// ─────────────────────────── Reusable form atoms ───────────────────────────

/** Light gray spacer between Jobber's form sections (~12px). */
export function SectionSpacer() {
  return <div className="h-3 bg-[#f5f5f5] dark:bg-neutral-950" />;
}

/** Subtle gray section label (e.g., "Overview", "Schedule"). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
      {children}
    </p>
  );
}

/** Bordered text input matching Jobber's style. */
export function FieldInput({
  name,
  placeholder,
  type = "text",
  defaultValue,
  rightSlot,
  required,
}: {
  name: string;
  placeholder: string;
  type?: string;
  defaultValue?: string;
  rightSlot?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="relative px-4 py-2">
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
      />
      {rightSlot && (
        <div className="absolute right-7 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

/** Multi-line text area matching Jobber's style. */
export function FieldTextarea({
  name,
  placeholder,
  defaultValue,
  rows = 3,
}: {
  name: string;
  placeholder: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <div className="px-4 py-2">
      <textarea
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        rows={rows}
        className="w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
      />
    </div>
  );
}

/** Field with a small label sitting above the value (Material-style). */
export function FieldStacked({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block px-4 py-2">
      <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <input
          type="text"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="mt-0.5 w-full bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
        />
      </div>
    </label>
  );
}

/** Big green action link / picker button (e.g., "Select Existing Client"). */
export function PickerButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="px-4 py-2">
      <Link
        href={href}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm font-bold text-[#1A7B40] active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
      >
        {icon}
        <span>{label}</span>
      </Link>
    </div>
  );
}

/** Plain green "+ Add foo" link with a leading icon. */
export function AddLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-5 w-5 items-center justify-center text-neutral-500 dark:text-neutral-400">
        {icon}
      </span>
      <Link
        href={href}
        className="text-sm font-bold text-[#1A7B40]"
      >
        {label}
      </Link>
    </div>
  );
}

/** Section row: leading icon + bold label + optional `+` add button on the right. */
export function SectionRow({
  icon,
  label,
  trailing,
}: {
  icon: React.ReactNode;
  label: string | React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-5 w-5 items-center justify-center text-[#1a2332] dark:text-white">
        {icon}
      </span>
      <div className="flex-1 text-sm font-bold text-[#1a2332] dark:text-white">
        {label}
      </div>
      {trailing}
    </div>
  );
}

/** Small green `+` circular button used as the trailing "add" affordance. */
export function PlusButton({ href }: { href?: string }) {
  if (href) {
    return (
      <Link
        href={href}
        aria-label="Add"
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#1A7B40]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label="Add"
      className="flex h-7 w-7 items-center justify-center rounded-full text-[#1A7B40]"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

/** Dropdown-style row (label on top, value + chevron). */
export function DropdownRow({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="truncate text-sm text-[#1a2332] dark:text-white">
            {value}
          </p>
        </div>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <input type="hidden" name={name} value={value} />
      </div>
    </div>
  );
}

/** Toggle row (label + iOS-style switch). */
export function ToggleRow({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
      <span className="flex-1 text-sm text-[#1a2332] dark:text-white">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-neutral-300 transition peer-checked:bg-[#1A7B40] dark:bg-neutral-600" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
