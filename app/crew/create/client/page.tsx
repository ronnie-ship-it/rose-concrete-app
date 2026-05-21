import { requireRole } from "@/lib/auth";
import { NewClientForm } from "./form";

export const metadata = { title: "New client — Rose Concrete" };

type SearchParams = Promise<{ error?: string }>;

/**
 * Crew "New client" — Phase 1.5 PR-A1 hotfix rewrite.
 *
 * Architectural changes from the previous implementation:
 *
 *   - Uses the NEW <CreateFormShell> from app/crew/_components/.
 *     The old shell at app/crew/create/chrome.tsx renders a sticky
 *     footer; the new shell does NOT. The Save button is inline at
 *     the bottom of the form scroll. (Other 5 Create forms still use
 *     the old chrome — they'll switch in PR-Y per the brief.)
 *
 *   - Uses the NEW <TextField> + <RevealRow> from app/crew/_components/.
 *     TextField has the iOS-Safari Bug-2 fixes (16 px font, navy
 *     caret, near-black text-fill, 48 px min-height) baked in.
 *
 *   - Default-show fields: First name, Last name, Property address.
 *     Tap-to-reveal rows: Phone, Email, Company Name, Lead Source,
 *     Additional Info. Matches the Day 2 §C.1 collapsed-until-tapped
 *     pattern.
 *
 * The actual reveal state + form submission lives in <NewClientForm>
 * (client component). This page is a thin server wrapper that does
 * the auth gate.
 */
export default async function CrewNewClient({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["crew", "admin", "office"]);
  const sp = await searchParams;
  return <NewClientForm errorFromUrl={sp.error ?? null} />;
}
