"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type WorkSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayKey = (typeof DAY_KEYS)[number];

export async function saveWorkSettingsAction(
  _prev: WorkSettingsResult | null,
  fd: FormData,
): Promise<WorkSettingsResult> {
  try {
    await requireRole(["admin"]);
    const defaultVisitMin = Number(fd.get("default_visit_min") ?? 60);
    const bufferMin = Number(fd.get("buffer_between_min") ?? 15);
    const firstDow = Number(fd.get("first_day_of_week") ?? 1);
    const tz =
      String(fd.get("timezone") ?? "").trim() || "America/Los_Angeles";
    if (
      !Number.isFinite(defaultVisitMin) ||
      defaultVisitMin < 15 ||
      defaultVisitMin > 24 * 60
    ) {
      return {
        ok: false,
        error: "Default visit duration must be between 15 minutes and 24 hours.",
      };
    }
    if (!Number.isFinite(bufferMin) || bufferMin < 0 || bufferMin > 240) {
      return { ok: false, error: "Buffer between visits must be 0–240 min." };
    }
    if (firstDow !== 0 && firstDow !== 1) {
      return { ok: false, error: "First day of week must be Sun (0) or Mon (1)." };
    }

    const working_hours: Record<
      DayKey,
      { start: string | null; end: string | null }
    > = {
      sun: { start: null, end: null },
      mon: { start: null, end: null },
      tue: { start: null, end: null },
      wed: { start: null, end: null },
      thu: { start: null, end: null },
      fri: { start: null, end: null },
      sat: { start: null, end: null },
    };
    for (const d of DAY_KEYS) {
      const start = String(fd.get(`hours_${d}_start`) ?? "").trim() || null;
      const end = String(fd.get(`hours_${d}_end`) ?? "").trim() || null;
      working_hours[d] = {
        start: start && end ? start : null,
        end: start && end ? end : null,
      };
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("work_settings")
      .update({
        default_visit_min: Math.round(defaultVisitMin),
        buffer_between_min: Math.round(bufferMin),
        first_day_of_week: firstDow,
        timezone: tz,
        working_hours,
      })
      .eq("singleton", true);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/work");
    revalidatePath("/dashboard/schedule");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save.",
    };
  }
}
