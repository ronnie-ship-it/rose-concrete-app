import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CrewCreateChrome,
  SectionLabel,
  SectionSpacer,
} from "../chrome";
import { ClientPickerRow, NotYetAvailable } from "../shared";

export const metadata = { title: "New invoice — Rose Concrete" };

type SearchParams = Promise<{ client_id?: string; error?: string }>;

/**
 * Crew "New Invoice" — Jobber-mobile parity.
 *
 *   - Client picker (taps through to /crew/pick/client?ret=…)
 *   - All other invoice fields show "Coming soon" — full invoice
 *     creation lives in the desktop app today. We render the form
 *     so the user can see what the flow will look like, but submit
 *     hands off to /crew with a friendly toast.
 *
 * Once the mobile invoice builder is ready, this page wires up to a
 * real `createInvoiceFromCrewAction`.
 */
export default async function CrewNewInvoice({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const sp = await searchParams;
  const clientId = sp.client_id ?? null;
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

  const desktopOnly = encodeURIComponent(
    "Invoice sending lives on the desktop app for now. The office will finish + send shortly after you save.",
  );

  return (
    <CrewCreateChrome
      title="New Invoice"
      saveLabel="Review and Send"
      saveHref={`/crew?error=${desktopOnly}`}
      secondaryLabel="Save"
      secondaryHref={`/crew?error=${desktopOnly}`}
    >
      {sp.error && (
        <p className="mx-4 mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {sp.error}
        </p>
      )}

      <SectionLabel>Billed to</SectionLabel>
      <ClientPickerRow ret="/crew/create/invoice" prefilled={client} />

      <SectionSpacer />

      <NotYetAvailable
        label="Invoice details"
        sublabel="Title, terms, salesperson, line items, and payment settings come from the desktop app for now. Pick the client and the office will finish from their workstation."
      />
    </CrewCreateChrome>
  );
}
