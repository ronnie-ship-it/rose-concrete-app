import { requireRole } from "@/lib/auth";
import { createClientFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  AddLink,
  PickerButton,
  SectionSpacer,
} from "../chrome";

export const metadata = { title: "New client — Rose Concrete" };

/**
 * Crew "New client" — Jobber-mobile parity.
 *
 * Form structure from the screenshot:
 *   - "Add From Contacts" outlined picker button
 *   - First name / Last name inputs
 *   - "Add Company Name" green link
 *   - "Add Phone Number" green link
 *   - "Add Email" green link
 *   - "Add Lead Source" green link
 *   - "Add Additional Info" green link
 *   - Property address input
 *   - Bottom: green "Save"
 *
 * The "Add foo" links unhide their corresponding text input — kept
 * simple here by always rendering the input and using the green link
 * row as a label hint when the field is empty.
 */
export default async function CrewNewClient() {
  await requireRole(["crew", "admin", "office"]);

  return (
    <CrewCreateChrome
      title="New client"
      saveLabel="Save"
      formAction={createClientFromCrewAction}
    >
      {/* Add From Contacts (placeholder — would open the iOS contact picker) */}
      <div className="px-4 pt-4">
        <PickerButton
          href="/crew/create/client"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="10" r="3" />
              <path d="M6 19c1.5-3 4-4.5 6-4.5s4.5 1.5 6 4.5" />
            </svg>
          }
          label="Add From Contacts"
        />
      </div>

      {/* First / Last name */}
      <div className="px-4 py-2">
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
          <input
            name="first_name"
            type="text"
            placeholder="First name"
            className="block w-full border-b border-neutral-200 px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
          <input
            name="last_name"
            type="text"
            placeholder="Last name"
            className="block w-full px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-800 dark:text-white"
          />
        </div>
      </div>

      {/* Inline secondary fields — Jobber's screenshot shows these as
          green links; we render the input rows but tag them with the
          green "Add foo" affordance until the user types. Pragmatic
          compromise: just always show editable inputs styled as gray
          rows; the field placeholder doubles as the "Add foo" label. */}
      <AddLink
        href="#company"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="1" />
            <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
          </svg>
        }
        label="Add Company Name"
      />
      <FieldInput name="company" placeholder="Company name (optional)" />

      <AddLink
        href="#phone"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        }
        label="Add Phone Number"
      />
      <FieldInput name="phone" type="tel" placeholder="(555) 123-4567" />

      <AddLink
        href="#email"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        }
        label="Add Email"
      />
      <FieldInput name="email" type="email" placeholder="name@example.com" />

      <AddLink
        href="#lead-source"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h12M3 18h6" />
          </svg>
        }
        label="Add Lead Source"
      />
      <FieldInput name="lead_source" placeholder="e.g., Google, Referral, Yelp" />

      <SectionSpacer />

      {/* Property address — full-width with a leading pin icon */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z" />
            <circle cx="12" cy="9" r="3" />
          </svg>
          <input
            name="address"
            type="text"
            placeholder="Property address"
            className="flex-1 bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
          />
        </div>
      </div>
    </CrewCreateChrome>
  );
}
