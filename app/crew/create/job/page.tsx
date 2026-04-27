import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CrewCreateChrome,
  FieldStacked,
  SectionLabel,
  SectionSpacer,
} from "../chrome";
import { ClientPickerRow, TeamPickerRow, NotYetAvailable } from "../shared";

export const metadata = { title: "New job — Rose Concrete" };

type SearchParams = Promise<{
  client_id?: string;
  user_id?: string;
  error?: string;
}>;

/**
 * Crew "New job" — Jobber-mobile parity.
 *
 *   - Client picker (taps through to /crew/pick/client?ret=…)
 *   - Job title + Instructions
 *   - Team picker (taps through to /crew/pick/team?ret=…)
 *   - Line items + invoicing reminder show "Coming soon" — these
 *     are office-side fields that need richer wiring.
 *
 * Saving redirects to /crew?error=… for now since the full
 * createJobFromCrewAction wiring (which would create a `projects`
 * row + an initial visit) hasn't shipped yet. The form is here so
 * crew can see + refine the layout; office staff still create
 * projects from the dashboard.
 */
export default async function CrewNewJob({
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
        name:
          (data.full_name as string | null) ??
          (data.email as string).split("@")[0],
      };
    }
  }

  const desktopOnly = encodeURIComponent(
    "Job creation finishes on the desktop app. Office staff will follow up to schedule.",
  );

  return (
    <CrewCreateChrome
      title="New job"
      saveLabel="Save"
      saveHref={`/crew?error=${desktopOnly}`}
    >
      {sp.error && (
        <p className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {sp.error}
        </p>
      )}

      <SectionLabel>Client info</SectionLabel>
      <ClientPickerRow ret="/crew/create/job" prefilled={client} />

      <SectionSpacer />

      <SectionLabel>Overview</SectionLabel>
      <FieldStacked label="Job title" name="title" placeholder="e.g. Driveway pour" />
      <div className="px-4 py-2">
        <textarea
          name="instructions"
          placeholder="Instructions"
          rows={3}
          className="w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
      </div>

      <SectionSpacer />

      <SectionLabel>Team</SectionLabel>
      <TeamPickerRow ret="/crew/create/job" prefilled={teamMember} />

      <SectionSpacer />

      <NotYetAvailable
        label="Line items + scheduling"
        sublabel="Line items, full schedule pickers, and the invoicing reminder come online once the desktop quote-to-job flow ships on mobile."
      />
    </CrewCreateChrome>
  );
}
