"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type BusinessProfileResult =
  | { ok: true }
  | { ok: false; error: string };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayKey = (typeof DAY_KEYS)[number];

/**
 * Save the business profile singleton. The hours JSON is flattened from
 * form fields like `hours_mon_open` / `hours_mon_close`. Empty pairs
 * are normalized to `{open:null, close:null}` so the client hub can
 * render "Closed" without string-matching.
 */
export async function saveBusinessProfileAction(
  _prev: BusinessProfileResult | null,
  fd: FormData,
): Promise<BusinessProfileResult> {
  try {
    await requireRole(["admin"]);
    const hours: Record<DayKey, { open: string | null; close: string | null }> =
      {
        sun: { open: null, close: null },
        mon: { open: null, close: null },
        tue: { open: null, close: null },
        wed: { open: null, close: null },
        thu: { open: null, close: null },
        fri: { open: null, close: null },
        sat: { open: null, close: null },
      };
    for (const d of DAY_KEYS) {
      const open = String(fd.get(`hours_${d}_open`) ?? "").trim() || null;
      const close = String(fd.get(`hours_${d}_close`) ?? "").trim() || null;
      // Reject half-filled rows (open without close) → treat as closed
      hours[d] = { open: open && close ? open : null, close: open && close ? close : null };
    }

    const patch = {
      company_name: String(fd.get("company_name") ?? "").trim() || "Rose Concrete",
      legal_name: String(fd.get("legal_name") ?? "").trim() || null,
      tagline: String(fd.get("tagline") ?? "").trim() || null,
      bio: String(fd.get("bio") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim() || null,
      email: String(fd.get("email") ?? "").trim() || null,
      website: String(fd.get("website") ?? "").trim() || null,
      address_line_1: String(fd.get("address_line_1") ?? "").trim() || null,
      address_line_2: String(fd.get("address_line_2") ?? "").trim() || null,
      city: String(fd.get("city") ?? "").trim() || null,
      state: String(fd.get("state") ?? "").trim() || "CA",
      postal_code: String(fd.get("postal_code") ?? "").trim() || null,
      license_number: String(fd.get("license_number") ?? "").trim() || null,
      public_listing: String(fd.get("public_listing") ?? "") === "on",
      keep_address_private:
        String(fd.get("keep_address_private") ?? "") === "on",
      hours,
      // Welcome video + phase-SMS templates (migration 038).
      welcome_video_url:
        String(fd.get("welcome_video_url") ?? "").trim() || null,
      phase_text_demo:
        String(fd.get("phase_text_demo") ?? "").trim() || null,
      phase_text_prep:
        String(fd.get("phase_text_prep") ?? "").trim() || null,
      phase_text_pour:
        String(fd.get("phase_text_pour") ?? "").trim() || null,
      phase_text_cleanup:
        String(fd.get("phase_text_cleanup") ?? "").trim() || null,
      phase_to_demo: String(fd.get("phase_to_demo") ?? "").trim() || null,
      phase_to_pour: String(fd.get("phase_to_pour") ?? "").trim() || null,
    };

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("business_profile")
      .update(patch)
      .eq("singleton", true);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/business-profile");
    revalidatePath("/hub");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save.",
    };
  }
}
