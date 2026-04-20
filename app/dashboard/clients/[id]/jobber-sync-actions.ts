"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * STUB — flag a client for Jobber sync.
 *
 * Doesn't call the Jobber API yet; that's a separate integration session.
 * Today this just toggles `clients.jobber_sync_status` to 'pending'
 * (or 'excluded' for the opt-out flow). A future cron will pick up
 * 'pending' rows, push to Jobber, and flip them to 'synced' (or back
 * to 'not_synced' on failure).
 *
 * Lives as a server action so the button can be a tiny client form
 * without writing a fetch handler.
 */
export async function flagClientForJobberSync(
  clientId: string,
  status: "pending" | "excluded",
) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ jobber_sync_status: status })
    .eq("id", clientId);

  if (error) {
    return { ok: false, error: error.message } as const;
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true } as const;
}
