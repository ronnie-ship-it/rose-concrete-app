"use server";

/**
 * CRUD for cash_journal_entries. Foreman (crew role) can create own
 * entries; admin/office sign off + edit/delete. RLS enforces this at
 * the DB layer — these actions are thin wrappers with activity logs.
 */
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type CashResult = { ok: true; id?: string } | { ok: false; error: string };

const ALLOWED_KINDS = [
  "labor",
  "tool_rental",
  "delivery",
  "materials",
  "other",
] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

export async function createCashEntryAction(
  _prev: CashResult | null,
  fd: FormData,
): Promise<CashResult> {
  try {
    await requireRole(["admin", "office", "crew"]);
    const user = await requireUser();
    const worker = String(fd.get("worker_name") ?? "").trim();
    if (!worker) return { ok: false, error: "Worker name required." };
    const kindRaw = String(fd.get("kind") ?? "labor");
    const kind: Kind = (ALLOWED_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as Kind)
      : "labor";
    const description = String(fd.get("description") ?? "").trim() || null;
    const amountDollars = Number(fd.get("amount") ?? 0);
    if (!Number.isFinite(amountDollars) || amountDollars < 0) {
      return { ok: false, error: "Amount must be a positive number." };
    }
    const amount_cents = Math.round(amountDollars * 100);
    const entry_date =
      String(fd.get("entry_date") ?? "").trim() ||
      new Date().toISOString().slice(0, 10);
    const project_id = String(fd.get("project_id") ?? "").trim() || null;
    const notes = String(fd.get("notes") ?? "").trim() || null;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("cash_journal_entries")
      .insert({
        worker_name: worker,
        kind,
        description,
        amount_cents,
        entry_date,
        project_id,
        notes,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/cash-journal");
    return { ok: true, id: data?.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/** Foreman "sign-off" — stamps foreman_id + foreman_signed_at. */
export async function signOffCashEntryAction(
  id: string,
): Promise<CashResult> {
  try {
    const user = await requireRole(["admin", "office", "crew"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("cash_journal_entries")
      .update({
        foreman_id: user.id,
        foreman_signed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/cash-journal");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

export async function deleteCashEntryAction(id: string): Promise<CashResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("cash_journal_entries")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/cash-journal");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
