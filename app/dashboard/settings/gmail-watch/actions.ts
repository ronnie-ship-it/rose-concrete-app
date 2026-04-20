"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type GmailWatchResult = { ok: true } | { ok: false; error: string };

export async function addWatchedSenderAction(
  _prev: GmailWatchResult | null,
  fd: FormData,
): Promise<GmailWatchResult> {
  try {
    await requireRole(["admin"]);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const label = String(fd.get("label") ?? "").trim() || null;
    const note = String(fd.get("note") ?? "").trim() || null;
    if (!email || !/.+@.+\..+/.test(email)) {
      return { ok: false, error: "Valid email required." };
    }
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("gmail_watched_senders")
      .upsert({ email, label, note, is_active: true }, { onConflict: "email" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/gmail-watch");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save.",
    };
  }
}

export async function toggleWatchedSenderAction(
  id: string,
  isActive: boolean,
): Promise<GmailWatchResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("gmail_watched_senders")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/gmail-watch");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle.",
    };
  }
}

export async function deleteWatchedSenderAction(
  id: string,
): Promise<GmailWatchResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("gmail_watched_senders")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/gmail-watch");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete.",
    };
  }
}
