"use client";

/**
 * "Add from Contacts" button — opens the device's native contact
 * picker via the browser Contact Picker API and pre-fills the New
 * Client form with the chosen contact's name + phone (+ email when
 * available).
 *
 * Browser support (verified Apr 2026):
 *   - Android Chrome 80+ (full support — `navigator.contacts.select`)
 *   - Android Edge / Samsung Internet (full support, same API)
 *   - iOS Safari: NOT supported. Apple has not shipped the Contact
 *     Picker API. Tapping the button on iOS triggers the fallback
 *     state below — the button stays visible but shows "Not
 *     available on this browser" and is non-tappable.
 *   - Desktop Chrome / Firefox / Safari: NOT supported — same
 *     fallback applies.
 *
 * Why the button stays visible even when unsupported: the Jobber
 * iOS screenshot shows it prominently at the top of the form, and
 * mixing it in with conditionally-hidden affordances confuses
 * users. A subtle "(unavailable)" tag is friendlier than no button.
 *
 * What we read from each contact:
 *   - `name`  — full name string. We split on whitespace into first
 *     and last; if there's no last token, we still set first.
 *   - `tel`   — first phone number, normalized to digits + leading +.
 *   - `email` — first email if present.
 *
 * What we DON'T request:
 *   - `address` — the API exposes structured address differently
 *     across browsers and we'd have to reconcile against the
 *     Places autocomplete fields. Skipped for v1.
 */
import { useEffect, useState } from "react";

// Locally-typed shim for the Contact Picker API. Avoids pulling in a
// full DOM types polyfill — we only touch a tiny slice.
type ContactProperty = "name" | "tel" | "email" | "address" | "icon";
type ContactsManager = {
  select(
    properties: ContactProperty[],
    options?: { multiple?: boolean },
  ): Promise<
    Array<{
      name?: string[];
      tel?: string[];
      email?: string[];
    }>
  >;
  getProperties(): Promise<ContactProperty[]>;
};

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

type Status = "idle" | "unsupported" | "working" | "ok" | "error";

/** Find a form input by `name=...` inside the same `<form>` and
 *  set its value. Falls back to a global lookup if no parent form
 *  is found (we render this button outside the form on some
 *  layouts). */
function setNamedInputValue(name: string, value: string) {
  const el =
    (document.querySelector(`input[name="${name}"]`) as
      | HTMLInputElement
      | null) ?? null;
  if (!el) return;
  // Set value via the React-aware property setter so React doesn't
  // wipe it on the next render. Setting `.value` directly is fine
  // for uncontrolled inputs (which the New Client form uses), but
  // this dispatch handles either case.
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  // Keep a leading + if present, strip non-digits otherwise.
  const lead = trimmed.startsWith("+") ? "+" : "";
  return lead + trimmed.replace(/[^0-9]/g, "");
}

export function ContactImportButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("contacts" in navigator) ||
      typeof navigator.contacts?.select !== "function"
    ) {
      setStatus("unsupported");
    }
  }, []);

  async function pick() {
    setError(null);
    if (!navigator.contacts?.select) {
      setStatus("unsupported");
      return;
    }
    setStatus("working");
    try {
      const contacts = await navigator.contacts.select(
        ["name", "tel", "email"],
        { multiple: false },
      );
      if (!contacts || contacts.length === 0) {
        // User cancelled the picker.
        setStatus("idle");
        return;
      }
      const c = contacts[0];
      const fullName = (c.name ?? []).find(Boolean) ?? "";
      const phone = (c.tel ?? []).find(Boolean) ?? "";
      const email = (c.email ?? []).find(Boolean) ?? "";

      if (fullName) {
        const { first, last } = splitName(fullName);
        if (first) setNamedInputValue("first_name", first);
        if (last) setNamedInputValue("last_name", last);
      }
      if (phone) setNamedInputValue("phone", normalizePhone(phone));
      if (email) setNamedInputValue("email", email);

      setStatus("ok");
      // Reset the "Imported ✓" pill after a beat so the button
      // returns to its default label.
      setTimeout(() => setStatus("idle"), 2200);
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Couldn't read contact.";
      // The user denying permission throws — it's not really an
      // error from our perspective, so we don't show their decline
      // as a red error message.
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("user")) {
        setStatus("idle");
        return;
      }
      setError(msg);
    }
  }

  const disabled = status === "working" || status === "unsupported";

  return (
    <div className="px-4 py-2">
      <button
        type="button"
        onClick={pick}
        disabled={disabled}
        aria-disabled={disabled}
        className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-bold transition ${
          status === "unsupported"
            ? "border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/50"
            : "border-neutral-200 bg-white text-[#1A7B40] active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6 19c1.5-3 4-4.5 6-4.5s4.5 1.5 6 4.5" />
        </svg>
        <span>
          {status === "working"
            ? "Opening contacts…"
            : status === "ok"
              ? "Imported ✓"
              : status === "unsupported"
                ? "Add from Contacts (unavailable)"
                : "Add from Contacts"}
        </span>
      </button>
      {status === "unsupported" && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          The Contact Picker isn&apos;t available on this browser. It
          works on Android Chrome — on iPhone, copy the contact in
          manually.
        </p>
      )}
      {error && status === "error" && (
        <p className="mt-1 text-[11px] text-red-600">{error}</p>
      )}
    </div>
  );
}
