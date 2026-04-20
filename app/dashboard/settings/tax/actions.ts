"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";

export async function addTaxRateAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const label = String(fd.get("label") ?? "").trim();
  const rate = Number(fd.get("rate_percent") ?? 0);
  const isDefault = fd.get("is_default") === "on";
  if (!label || !Number.isFinite(rate)) return;

  const supabase = createServiceRoleClient();
  if (isDefault) {
    await supabase
      .from("tax_rates")
      .update({ is_default: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }
  await supabase.from("tax_rates").insert({
    label,
    rate_percent: rate,
    is_default: isDefault,
  });
  revalidatePath("/dashboard/settings/tax");
}

export async function deleteTaxRateAction(id: string): Promise<void> {
  await requireRole(["admin"]);
  const supabase = createServiceRoleClient();
  await supabase.from("tax_rates").delete().eq("id", id);
  revalidatePath("/dashboard/settings/tax");
}
