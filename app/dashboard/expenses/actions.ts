"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type ExpenseResult = { ok: true } | { ok: false; error: string };

const CATEGORIES = [
  "materials",
  "concrete",
  "rebar",
  "equipment_rental",
  "subcontractor",
  "fuel",
  "permit_fee",
  "labor",
  "other",
] as const;

export async function createExpenseAction(
  _prev: ExpenseResult | null,
  fd: FormData,
): Promise<ExpenseResult> {
  try {
    const user = await requireRole(["admin", "office", "crew"]);
    const projectId = String(fd.get("project_id") ?? "") || null;
    const vendor = String(fd.get("vendor") ?? "").trim() || null;
    const categoryRaw = String(fd.get("category") ?? "other");
    const category = (CATEGORIES as readonly string[]).includes(categoryRaw)
      ? categoryRaw
      : "other";
    const amount = Number(fd.get("amount") ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: "Amount must be a positive number." };
    }
    const note = String(fd.get("note") ?? "").trim() || null;
    const expenseDateRaw = String(fd.get("expense_date") ?? "").trim();
    const paidFrom = String(fd.get("paid_from") ?? "").trim() || null;

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("expenses").insert({
      project_id: projectId,
      vendor,
      category,
      amount,
      note,
      expense_date: expenseDateRaw || undefined,
      paid_from: paidFrom,
      created_by: user.id,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/expenses");
    if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

export async function deleteExpenseAction(
  id: string,
): Promise<ExpenseResult> {
  try {
    await requireUser();
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/expenses");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
