"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function saveReviewSettingsAction(
  _prev: SettingsState,
  fd: FormData
): Promise<SettingsState> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const enabled = fd.get("enabled") === "on";
  const google_review_url = ((fd.get("google_review_url") ?? "") as string).trim();
  const channel = ((fd.get("channel") ?? "email") as string).trim();

  if (google_review_url && !/^https?:\/\//.test(google_review_url)) {
    return { ok: false, error: "Google review URL must start with http(s)://" };
  }

  const { error } = await supabase
    .from("feature_flags")
    .update({
      enabled,
      config: { google_review_url, channel },
      updated_at: new Date().toISOString(),
    })
    .eq("key", "review_request_auto_send");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/reviews");
  return { ok: true };
}
