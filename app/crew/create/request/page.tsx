import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createRequestFromCrewAction } from "../actions";
import {
  CrewCreateChrome,
  FieldInput,
  FieldTextarea,
  SectionLabel,
  SectionSpacer,
} from "../chrome";
import { ClientPickerRow, NotYetAvailable } from "../shared";

export const metadata = { title: "New request — Rose Concrete" };

type SearchParams = Promise<{ client_id?: string; error?: string }>;

/**
 * Crew "New request" — Jobber-mobile parity.
 *
 *   - Client picker (taps through to /crew/pick/client?ret=…)
 *   - Request title input (writes to `leads.contact_name`)
 *   - "How can we help?" textarea (writes to `leads.notes`)
 *   - Image upload + line items + schedule rows are intentionally
 *     non-functional for v1 (clearly tagged "Coming soon" so taps
 *     don't crash). They'll wire to real handlers when each
 *     subsystem ships.
 *   - Save Request → leads.insert + redirect to /crew?saved=request
 */
export default async function CrewNewRequest({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const sp = await searchParams;
  const clientId = sp.client_id ?? null;
  const supabase = await createClient();

  let prefilled: { id: string; name: string } | null = null;
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();
    prefilled = data ?? null;
  }

  return (
    <CrewCreateChrome
      title="New request"
      saveLabel="Save Request"
      formAction={createRequestFromCrewAction}
    >
      {sp.error && (
        <p className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {sp.error}
        </p>
      )}

      {/* For / Client picker */}
      <SectionLabel>For</SectionLabel>
      <ClientPickerRow ret="/crew/create/request" prefilled={prefilled} />

      <SectionSpacer />

      {/* Title */}
      <FieldInput name="title" placeholder="Request title" required />

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
        rows={4}
      />

      <SectionSpacer />

      <NotYetAvailable
        label="Upload images"
        sublabel="Photo uploads are coming soon. For now, ask the client to send photos via OpenPhone."
      />

      <SectionSpacer />

      <NotYetAvailable
        label="Line items"
        sublabel="Add line items from the desktop app once the client confirms scope."
      />

      <SectionSpacer />

      <NotYetAvailable
        label="Schedule"
        sublabel="Office staff will call to schedule once the request lands."
      />
    </CrewCreateChrome>
  );
}
