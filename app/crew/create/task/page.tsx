import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTaskFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  FieldTextarea,
  SectionLabel,
  SectionSpacer,
} from "../chrome";
import { ClientPickerRow, TeamPickerRow } from "../shared";

export const metadata = { title: "New task — Rose Concrete" };

type SearchParams = Promise<{
  client_id?: string;
  user_id?: string;
  error?: string;
}>;

/**
 * Crew "New task" — Jobber-mobile parity.
 *
 *   - Title + Description
 *   - Client picker (taps through to /crew/pick/client?ret=…)
 *   - Date picker (native HTML date input)
 *   - Team picker (taps through to /crew/pick/team?ret=…)
 *   - Save → tasks.insert + redirect to /crew?saved=task
 */
export default async function CrewNewTask({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const sp = await searchParams;
  const clientId = sp.client_id ?? null;
  const userId = sp.user_id ?? null;
  const supabase = await createClient();

  let client: { id: string; name: string } | null = null;
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();
    client = data ?? null;
  }
  let teamMember: { id: string; name: string } | null = null;
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      teamMember = {
        id: data.id,
        name: (data.full_name as string | null) ?? (data.email as string).split("@")[0],
      };
    }
  }

  return (
    <CrewCreateChrome
      title="New task"
      saveLabel="Save"
      formAction={createTaskFromCrewAction}
    >
      {sp.error && (
        <p className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {sp.error}
        </p>
      )}

      <div className="pt-4" />
      <FieldInput name="title" placeholder="Title" required />
      <FieldTextarea name="description" placeholder="Description" rows={3} />

      <SectionSpacer />

      <ClientPickerRow ret="/crew/create/task" prefilled={client} />

      <SectionSpacer />

      <SectionLabel>Schedule</SectionLabel>
      <div className="px-4 py-2">
        <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Due date
            </p>
            <input
              name="due_date"
              type="date"
              className="block w-full bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
            />
          </div>
        </div>
      </div>

      <TeamPickerRow ret="/crew/create/task" prefilled={teamMember} />
    </CrewCreateChrome>
  );
}
