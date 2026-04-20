"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveAutomationConfigAction(
  _prev: SaveResult | null,
  fd: FormData
): Promise<SaveResult> {
  await requireRole(["admin"]);
  const num = (k: string): number => {
    const n = Number(fd.get(k) ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("automation_config")
    .select("id")
    .limit(1)
    .maybeSingle();

  const payload = {
    quote_followup_first_days: num("quote_followup_first_days"),
    quote_followup_second_days: num("quote_followup_second_days"),
    quote_cold_after_days: num("quote_cold_after_days"),
    postjob_thankyou_days: num("postjob_thankyou_days"),
    postjob_review_days: num("postjob_review_days"),
    postjob_checkin_days: num("postjob_checkin_days"),
    review_url: String(fd.get("review_url") ?? "").trim() || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("automation_config")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("automation_config").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/automations");
  return { ok: true };
}
