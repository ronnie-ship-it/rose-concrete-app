import { requireRole } from "@/lib/auth";
import { createRequestFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  FieldTextarea,
  SectionLabel,
  SectionRow,
  PlusButton,
  SectionSpacer,
} from "../chrome";

export const metadata = { title: "New request — Rose Concrete" };

/**
 * Crew "New request" — Jobber-mobile parity.
 *
 *   - "For" label
 *   - Client picker row (👤 Client + green +)
 *   - Request title input
 *   - "Request form" section header
 *   - "How can we help?" + textarea ("What kind of concrete work…")
 *   - "Upload images" with photo placeholder + "0/10" pill
 *   - "Product / Service" header + Line items + green +
 *   - "Assessment details" header + 📅 Schedule row + green +
 *   - Bottom: green "Save Request"
 */
export default async function CrewNewRequest() {
  await requireRole(["crew", "admin", "office"]);

  return (
    <CrewCreateChrome
      title="New request"
      saveLabel="Save Request"
      formAction={createRequestFromCrewAction}
    >
      {/* For / Client picker */}
      <SectionLabel>For</SectionLabel>
      <SectionRow
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />
          </svg>
        }
        label="Client"
        trailing={<PlusButton href="/dashboard/clients" />}
      />

      <SectionSpacer />

      {/* Title */}
      <FieldInput name="title" placeholder="Request title" />

      <SectionSpacer />

      {/* Request form */}
      <SectionLabel>Request form</SectionLabel>
      <div className="px-4">
        <p className="text-sm font-bold text-[#1a2332] dark:text-white">
          How can we help?
        </p>
      </div>
      <FieldTextarea
        name="description"
        placeholder="What kind of concrete work do you need?"
        rows={3}
      />

      <SectionSpacer />

      {/* Upload images */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#1a2332] dark:text-white">
            Upload images
          </p>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            0/10
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Share images of the work to be done
        </p>
        <button
          type="button"
          className="mt-3 flex h-14 w-14 items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-white text-neutral-400 dark:border-neutral-600 dark:bg-neutral-800"
          aria-label="Add image"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1A7B40]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M21 17l-5-5-9 9" />
          </svg>
        </button>
      </div>

      <SectionSpacer />

      {/* Product / Service */}
      <SectionLabel>Product / Service</SectionLabel>
      <SectionRow
        icon={null}
        label="Line items"
        trailing={<PlusButton />}
      />

      <SectionSpacer />

      {/* Assessment details */}
      <SectionLabel>Assessment details</SectionLabel>
      <SectionRow
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
          </svg>
        }
        label="Schedule"
        trailing={<PlusButton />}
      />
    </CrewCreateChrome>
  );
}
