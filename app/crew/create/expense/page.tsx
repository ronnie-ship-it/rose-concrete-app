import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createExpenseFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  FieldTextarea,
  SectionLabel,
  SectionSpacer,
} from "../chrome";
import { ProjectPickerRow, NotYetAvailable } from "../shared";

export const metadata = { title: "New expense — Rose Concrete" };

type SearchParams = Promise<{ project_id?: string; error?: string }>;

/**
 * Crew "New Expense" — Jobber-mobile parity.
 *
 *   - Title + Description
 *   - Date picker (native HTML date input, defaults to today)
 *   - Total ($)
 *   - Linked job picker (taps through to /crew/pick/project?ret=…)
 *   - Reimburse-to + Accounting code shown as "Coming soon" — both
 *     need account / payroll wiring we don't have yet.
 *   - Save → expenses.insert + redirect to /crew?saved=expense
 */
export default async function CrewNewExpense({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const sp = await searchParams;
  const projectId = sp.project_id ?? null;
  const supabase = await createClient();

  let project: { id: string; name: string } | null = null;
  if (projectId) {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();
    project = data ?? null;
  }

  const isoToday = new Date().toISOString().slice(0, 10);

  return (
    <CrewCreateChrome
      title="New Expense"
      saveLabel="Save"
      formAction={createExpenseFromCrewAction}
    >
      {sp.error && (
        <p className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {sp.error}
        </p>
      )}

      <div className="pt-4" />
      <FieldInput name="title" placeholder="Title" required />
      <FieldTextarea name="description" placeholder="Description" rows={2} />

      {/* Date — native date picker, defaults to today */}
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
            required
            className="mt-0.5 w-full bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
          />
        </div>
      </div>

      <SectionSpacer />

      <SectionLabel>Reimburse to</SectionLabel>
      <NotYetAvailable
        label="Not reimbursable"
        sublabel="Per-employee reimbursement routing comes online once payroll is wired up. For now every expense saves as company-paid."
      />

      <SectionSpacer />

      <ProjectPickerRow ret="/crew/create/expense" prefilled={project} />

      <SectionSpacer />

      <NotYetAvailable
        label="Attach receipt"
        sublabel="Photo uploads are coming soon. Send the receipt to the office via email or text in the meantime."
      />
    </CrewCreateChrome>
  );
}
