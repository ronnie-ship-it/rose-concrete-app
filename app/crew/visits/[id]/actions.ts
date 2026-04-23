"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Crew-facing visit status + notes actions. Crew can only hit visits
 * they're assigned to (enforced by RLS — see migration 001). The actions
 * here mirror what Jobber's mobile "Start / Complete Visit" buttons do:
 * flip visits.status, set completed_at when done.
 */

export async function startVisitAction(id: string): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();
  await supabase
    .from("visits")
    .update({ status: "in_progress" })
    .eq("id", id)
    .in("status", ["scheduled"]);
  revalidatePath(`/crew/visits/${id}`);
  revalidatePath("/crew");
  revalidatePath("/crew/schedule");
}

export async function completeVisitAction(id: string): Promise<void> {
  await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();
  await supabase
    .from("visits")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  // Close any open clock-in for the visit under this user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("visit_time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("visit_id", id)
      .eq("user_id", user.id)
      .is("clock_out_at", null);
  }
  revalidatePath(`/crew/visits/${id}`);
  revalidatePath("/crew");
  revalidatePath("/crew/schedule");
}

export async function saveVisitNotesAction(
  id: string,
  _prev: { ok: boolean; error?: string } | null,
  fd: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["crew", "admin", "office"]);
  const notes = String(fd.get("notes") ?? "").slice(0, 10_000);
  const supabase = await createClient();
  const { error } = await supabase
    .from("visits")
    .update({ notes })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/crew/visits/${id}`);
  return { ok: true };
}
