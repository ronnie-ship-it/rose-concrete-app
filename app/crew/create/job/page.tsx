import { requireRole } from "@/lib/auth";
import {
  CrewCreateChrome,
  FieldStacked,
  PickerButton,
  AddLink,
  DropdownRow,
  SectionLabel,
  SectionRow,
  PlusButton,
  SectionSpacer,
  ToggleRow,
} from "../chrome";

export const metadata = { title: "New job — Rose Concrete" };

/**
 * Crew "New job" — Jobber-mobile parity.
 *
 *   - "Client info" label
 *   - "🔍 Select Existing Client" picker
 *   - First name / Last name / Property address
 *   - "Add Phone Number" / "Add Email"
 *   - "Overview"
 *   - Job title
 *   - Instructions (textarea)
 *   - Salesperson
 *   - "Product / Service" / Line items + green +
 *   - Subtotal $0.00
 *   - "Schedule" section
 *     - "Schedule later" toggle
 *     - April 2026 inline calendar (← →) — 24 highlighted as today
 *   - 👥 Team / Thomas Ronnie Rose + arrow →
 *   - "Invoicing"
 *     - Toggle: "Remind me to invoice when I close the job" (ON)
 *   - Bottom: green "Save"
 *
 * Saving routes to the dashboard projects/new flow for now.
 */
export default async function CrewNewJob() {
  await requireRole(["crew", "admin", "office"]);

  const today = new Date();
  const monthLabel = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const days = buildMonthGrid(today);

  return (
    <CrewCreateChrome
      title="New job"
      saveLabel="Save"
      saveHref="/dashboard/projects/new"
    >
      <SectionLabel>Client info</SectionLabel>
      <PickerButton
        href="/dashboard/clients"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        }
        label="Select Existing Client"
      />
      <FieldStacked label="" name="first_name" placeholder="First name" />
      <FieldStacked label="" name="last_name" placeholder="Last name" />
      <FieldStacked label="" name="property_address" placeholder="Property address" />
      <AddLink
        href="#phone"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        }
        label="Add Phone Number"
      />
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

      <SectionSpacer />

      <SectionLabel>Overview</SectionLabel>
      <FieldStacked label="" name="title" placeholder="Job title" />
      <div className="px-4 py-2">
        <textarea
          name="instructions"
          placeholder="Instructions"
          rows={3}
          className="w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
      </div>
      <DropdownRow name="salesperson" label="Salesperson" value="Please select" />

      <SectionSpacer />

      <SectionLabel>Product / Service</SectionLabel>
      <SectionRow icon={null} label="Line items" trailing={<PlusButton />} />
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-[#1a2332] dark:text-white">Subtotal</span>
        <span className="text-sm font-bold text-[#1a2332] dark:text-white">
          $0.00
        </span>
      </div>

      <SectionSpacer />

      <SectionLabel>Schedule</SectionLabel>
      <ToggleRow name="schedule_later" label="Schedule later" />

      {/* Inline month calendar */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center justify-between pb-2">
          <p className="text-base font-extrabold text-[#1a2332] dark:text-white">
            {monthLabel}
          </p>
          <div className="flex items-center gap-1 text-[#1A7B40]">
            <button
              type="button"
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-neutral-500">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {days.map((d, i) => (
            <div key={i} className="flex items-center justify-center py-1">
              {d ? (
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                    d.isToday
                      ? "bg-[#1A7B40] text-white font-bold"
                      : d.isOtherMonth
                        ? "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                        : "text-[#1a2332] dark:text-white"
                  }`}
                >
                  {d.day}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <SectionSpacer />

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

      <SectionSpacer />

      <SectionLabel>Invoicing</SectionLabel>
      <ToggleRow
        name="invoice_reminder"
        label="Remind me to invoice when I close the job"
        defaultChecked
      />
    </CrewCreateChrome>
  );
}

/** Build a 6-row × 7-column month grid for `date`'s month. Other-month
 *  cells are dim placeholders so the grid is always uniform. */
function buildMonthGrid(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay(); // 0 = Sun
  const totalDays = last.getDate();
  const todayDay =
    date.getFullYear() === year && date.getMonth() === month
      ? date.getDate()
      : -1;
  const cells: Array<{ day: number; isToday: boolean; isOtherMonth: boolean } | null> =
    [];
  // Leading days from prev month for grid alignment
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevLast - i, isToday: false, isOtherMonth: true });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, isToday: d === todayDay, isOtherMonth: false });
  }
  // Trailing days to fill the grid
  let nd = 1;
  while (cells.length < 42) {
    cells.push({ day: nd++, isToday: false, isOtherMonth: true });
  }
  return cells;
}
