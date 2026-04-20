"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ToggleState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function toggleLeadWebhookAction(
  _prev: ToggleState,
  fd: FormData
): Promise<ToggleState> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const enabled = fd.get("enabled") === "on";
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", "lead_webhook");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/lead-webhook");
  return { ok: true };
}
