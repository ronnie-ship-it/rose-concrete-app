import { requireRole } from "@/lib/auth";
import { createExpenseFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  FieldTextarea,
  DropdownRow,
  SectionRow,
  PlusButton,
  SectionSpacer,
} from "../chrome";

export const metadata = { title: "New expense — Rose Concrete" };

/**
 * Crew "New Expense" — Jobber-mobile parity.
 *
 *   - Title input
 *   - Description input
 *   - Date row (calendar icon + label "Apr 24, 2026")
 *   - Total input
 *   - Reimburse to dropdown
 *   - Accounting code dropdown
 *   - "No accounting codes found..." note
 *   - 🔧 Linked job + green +
 *   - "Attach receipt" with image upload box
 *   - Bottom: green "Save"
 */
export default async function CrewNewExpense() {
  await requireRole(["crew", "admin", "office"]);
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isoToday = new Date().toISOString().slice(0, 10);

  return (
    <CrewCreateChrome
      title="New Expense"
      saveLabel="Save"
      formAction={createExpenseFromCrewAction}
    >
      <div className="pt-4" />
      <FieldInput name="title" placeholder="Title" required />
      <FieldTextarea name="description" placeholder="Description" rows={2} />

      {/* Date — visible label + native date picker */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Date
            </p>
            <input
              type="date"
              name="date"
              defaultValue={isoToday}
              className="block w-full bg-transparent text-sm text-[#1a2332] focus:outline-none dark:text-white"
              aria-label={`Date: ${today}`}
            />
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="px-4 py-2">
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Total
          </p>
          <input
            type="text"
            name="total"
            inputMode="decimal"
            placeholder="$0.00"
            className="mt-0.5 w-full bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
          />
        </div>
      </div>

      <DropdownRow name="reimburse_to" label="Reimburse to" value="Not reimbursable" />
      <DropdownRow name="accounting_code" label="Accounting code" value="None" />

      <p className="px-4 py-1 text-xs text-neutral-500 dark:text-neutral-400">
        No accounting codes found. To add codes, use Jobber in your web browser.
      </p>

      <SectionSpacer />

      <SectionRow
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: "#1A7B40" }}>
            <path d="M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z" />
          </svg>
        }
        label={<span className="text-[#1A7B40]">Linked job</span>}
        trailing={<PlusButton href="/dashboard/projects" />}
      />

      <SectionSpacer />

      <div className="px-4 pt-4 pb-2">
        <p className="text-sm font-bold text-[#1a2332] dark:text-white">
          Attach receipt
        </p>
        <button
          type="button"
          aria-label="Attach receipt"
          className="mt-3 flex h-20 w-full items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-white text-neutral-400 dark:border-neutral-600 dark:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1A7B40]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M21 17l-5-5-9 9" />
          </svg>
        </button>
      </div>
    </CrewCreateChrome>
  );
}
