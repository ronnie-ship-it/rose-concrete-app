"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Crew clock-in / clock-out. GPS lat+lng captured client-side from the
 * browser geolocation API and passed in as form data. We don't block the
 * clock-in if permission is denied — an entry with NULL coords is still
 * better than no record.
 */

export type ClockState =
  | { ok: true; action: "clock_in" | "clock_out" }
  | { ok: false; error: string }
  | null;

async function currentCrewId(): Promise<string> {
  const user = await requireRole(["crew", "admin", "office"]);
  return user.id;
}

function parseCoord(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function clockInAction(
  visitId: string,
  _prev: ClockState,
  fd: FormData
): Promise<ClockState> {
  const userId = await currentCrewId();
  const supabase = await createClient();

  // Block duplicate open clock-ins for this (visit, user).
  const { data: open } = await supabase
    .from("visit_time_entries")
    .select("id")
    .eq("visit_id", visitId)
    .eq("user_id", userId)
    .is("clock_out_at", null)
    .maybeSingle();
  if (open) {
    return { ok: false, error: "You're already clocked in." };
  }

  const { error } = await supabase.from("visit_time_entries").insert({
    visit_id: visitId,
    user_id: userId,
    clock_in_at: new Date().toISOString(),
    clock_in_lat: parseCoord(fd.get("lat")),
    clock_in_lng: parseCoord(fd.get("lng")),
  });
  if (error) return { ok: false, error: error.message };

  // Flip visit to in_progress if it was still scheduled.
  await supabase
    .from("visits")
    .update({ status: "in_progress" })
    .eq("id", visitId)
    .eq("status", "scheduled");

  revalidatePath("/crew");
  return { ok: true, action: "clock_in" };
}

export async function clockOutAction(
  visitId: string,
  _prev: ClockState,
  fd: FormData
): Promise<ClockState> {
  const userId = await currentCrewId();
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("visit_time_entries")
    .select("id")
    .eq("visit_id", visitId)
    .eq("user_id", userId)
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!open) return { ok: false, error: "You're not clocked in." };

  const { error } = await supabase
    .from("visit_time_entries")
    .update({
      clock_out_at: new Date().toISOString(),
      clock_out_lat: parseCoord(fd.get("lat")),
      clock_out_lng: parseCoord(fd.get("lng")),
    })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/crew");
  return { ok: true, action: "clock_out" };
}
