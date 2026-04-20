"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type FlagResult = { ok: true } | { ok: false; error: string };

export async function toggleAutoInvoiceAction(
  enabled: boolean,
): Promise<FlagResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("feature_flags")
      .upsert(
        { key: "qbo_auto_invoice", enabled, config: {} },
        { onConflict: "key" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/qbo-payments");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle.",
    };
  }
}
