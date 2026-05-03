"use client";

/**
 * NewClientForm — the client component half of /crew/create/client.
 *
 * Owns:
 *   - Tap-to-reveal state for Phone / Email / Company / Lead Source /
 *     Additional Info (Day 2 §C.1 pattern).
 *   - The <form> element wired to createClientFromCrewAction.
 *   - The inline Save button + Cancel link rendered as the last
 *     children of the form's scroll (PR-A1 Bug 1 architectural fix).
 *
 * Does NOT own:
 *   - Header / safe-area chrome — that's <CreateFormShell>.
 *   - Input styling — that's <TextField>.
 *   - Address autocomplete — defers to the existing
 *     <AddressAutocomplete>. The brief mentions a NEW <AddressField>
 *     component but the user explicitly excluded it from PR-A1 scope
 *     ("just the two new components + the Add Client page"); that
 *     wrapper ships in PR-Y.
 */
import { useState } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { ContactImportButton } from "@/components/contact-import-button";
import {
  CreateFormShell,
  SaveButton,
  CancelLink,
} from "@/app/crew/_components/CreateFormShell";
import { TextField, RevealRow } from "@/app/crew/_components/TextField";
import { createClientFromCrewAction } from "../actions";

type RevealKey = "phone" | "email" | "company" | "lead_source" | "notes";

export function NewClientForm({ errorFromUrl }: { errorFromUrl: string | null }) {
  // Tap-to-reveal state. Once a row is revealed it stays revealed —
  // the user might want to clear and retype, and re-collapsing the
  // row would dump their input. Re-collapsing is a separate gesture
  // (out of scope for PR-A1).
  const [revealed, setRevealed] = useState<Record<RevealKey, boolean>>({
    phone: false,
    email: false,
    company: false,
    lead_source: false,
    notes: false,
  });

  const reveal = (key: RevealKey) =>
    setRevealed((prev) => ({ ...prev, [key]: true }));

  return (
    <CreateFormShell title="New client">
      <form action={createClientFromCrewAction} className="space-y-4 px-4 py-4">
        {/* Inline error banner — populated when the server action
            redirected with ?error=… on validation failure. */}
        {errorFromUrl && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorFromUrl}
          </p>
        )}

        {/* Add From Contacts — first row of the form per Day 2 §C.4.
            Component handles its own browser-API gating (Android
            Chrome + recent iOS Safari). */}
        <ContactImportButton />

        {/* Default-shown fields: First / Last / Property address */}
        <TextField
          label="First name"
          name="first_name"
          autoComplete="given-name"
        />
        <TextField
          label="Last name"
          name="last_name"
          autoComplete="family-name"
        />

        {/* Reveal rows — collapsed until tapped (Day 2 §C.1). Each
            row swaps to a real <TextField> on click. */}
        {revealed.phone ? (
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            autoFocus
          />
        ) : (
          <RevealRow
            label="Add Phone Number"
            onClick={() => reveal("phone")}
            icon={
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            }
          />
        )}

        {revealed.email ? (
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
          />
        ) : (
          <RevealRow
            label="Add Email"
            onClick={() => reveal("email")}
            icon={
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
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            }
          />
        )}

        {revealed.company ? (
          <TextField
            label="Company name"
            name="company"
            autoComplete="organization"
            autoFocus
          />
        ) : (
          <RevealRow
            label="Add Company Name"
            onClick={() => reveal("company")}
            icon={
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
                <rect x="4" y="3" width="16" height="18" rx="1" />
                <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
              </svg>
            }
          />
        )}

        {revealed.lead_source ? (
          <TextField
            label="Lead source"
            name="lead_source"
            placeholder="e.g., Google, Referral, Yelp"
            autoFocus
          />
        ) : (
          <RevealRow
            label="Add Lead Source"
            onClick={() => reveal("lead_source")}
            icon={
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
                <path d="M3 6h18M3 12h12M3 18h6" />
              </svg>
            }
          />
        )}

        {revealed.notes ? (
          <NotesField />
        ) : (
          <RevealRow
            label="Add Additional Info"
            onClick={() => reveal("notes")}
            icon={
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
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            }
          />
        )}

        {/* Property address — kept always visible per Day 2 §C.1. The
            existing <AddressAutocomplete> already wires Google Places
            and writes the four address fields the server action
            reads. The new <AddressField> wrapper from the brief ships
            in PR-Y. */}
        <div className="pt-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Property address
          </label>
          <div className="mt-1">
            <AddressAutocomplete
              streetName="address"
              cityName="city"
              stateName="state"
              postalCodeName="postal_code"
              placeholder="123 Main St, San Diego, CA 92101"
            />
          </div>
        </div>

        {/* Inline Save button + Cancel link as the LAST children of
            the form scroll. NO sticky footer. (Bug 1 fix per Day 2
            §A: "Save button is INSIDE the scroll, not a sticky/fixed
            footer.") */}
        <div className="space-y-3 pt-4">
          <SaveButton label="Save" />
          <CancelLink href="/crew" />
        </div>
      </form>
    </CreateFormShell>
  );
}

/**
 * Notes field — multi-line textarea sibling of <TextField>. Same
 * Bug-2 fix profile (16 px font, navy caret, near-black fill).
 * Inlined here for PR-A1 because TextField is single-line only and
 * the brief specifically lists "Additional Info" as a reveal row. A
 * proper <Textarea> primitive lands in PR-Y when the rest of the
 * Create forms switch over.
 */
function NotesField() {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Additional info
      </label>
      <textarea
        name="notes"
        rows={3}
        autoFocus
        placeholder="Anything else worth remembering about this client?"
        style={{
          fontSize: 16,
          minHeight: 96,
          // TODO(PR-G): replace #1B2A4A with var(--brand-900) once Phase 2 tokens ship.
          caretColor: "#1B2A4A",
          // TODO(PR-G): replace #111827 with var(--text) once Phase 2 tokens ship.
          WebkitTextFillColor: "#111827",
        }}
        className="mt-1 block w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
      />
    </div>
  );
}
