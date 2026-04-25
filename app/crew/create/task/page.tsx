import { requireRole } from "@/lib/auth";
import { createTaskFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  FieldTextarea,
  SectionLabel,
  SectionRow,
  PlusButton,
  SectionSpacer,
} from "../chrome";

export const metadata = { title: "New task — Rose Concrete" };

/**
 * Crew "New task" — Jobber-mobile parity.
 *
 *   - Title + Description inputs (white cards, no leading icon)
 *   - 👤 Client + green +
 *   - "Schedule" section
 *     - 📅 Date / Unscheduled  (right-chevron-style row)
 *   - 👥 Team / Unassigned + arrow →
 *   - Bottom: green "Save"
 */
export default async function CrewNewTask() {
  await requireRole(["crew", "admin", "office"]);

  return (
    <CrewCreateChrome
      title="New task"
      saveLabel="Save"
      formAction={createTaskFromCrewAction}
    >
      <div className="pt-4" />
      <FieldInput name="title" placeholder="Title" required />
      <FieldTextarea name="description" placeholder="Description" rows={3} />

      <SectionSpacer />

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

      <SectionLabel>Schedule</SectionLabel>
      <div className="px-4 py-2">
        <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 3v4M16 3v4" />
            </svg>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Date
              </p>
              <input
                name="due_date"
                type="date"
                placeholder="Unscheduled"
                className="bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#1a2332] dark:text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M3 21c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5M14 21c0-2 2-3.5 4.5-3.5s4.5 1.5 4.5 3.5" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#1a2332] dark:text-white">
              Team
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Unassigned
            </p>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </CrewCreateChrome>
  );
}
