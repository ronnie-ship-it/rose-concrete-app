"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";

export async function addDiscountCodeAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  if (!code) return;
  const percentRaw = String(fd.get("percent_off") ?? "").trim();
  const amountRaw = String(fd.get("amount_off") ?? "").trim();
  const percent = percentRaw ? Number(percentRaw) : null;
  const amount = amountRaw ? Number(amountRaw) : null;

  const supabase = createServiceRoleClient();
  await supabase.from("discount_codes").insert({
    code,
    label: String(fd.get("label") ?? "").trim() || null,
    percent_off: percent,
    amount_off: amount,
    is_active: true,
  });
  revalidatePath("/dashboard/settings/discount-codes");
}

export async function toggleDiscountCodeAction(
  id: string,
  isActive: boolean
): Promise<void> {
  await requireRole(["admin"]);
  const supabase = createServiceRoleClient();
  await supabase.from("discount_codes").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/dashboard/settings/discount-codes");
}
