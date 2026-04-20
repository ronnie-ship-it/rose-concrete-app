"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type RuleResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const TRIGGERS = [
  "quote_approved",
  "quote_sent",
  "job_completed",
  "invoice_paid",
  "visit_scheduled",
  "visit_completed",
  "lead_captured",
] as const;

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return v as T;
  } catch {
    return fallback;
  }
}

export async function toggleRuleAction(
  id: string,
  enabled: boolean,
): Promise<RuleResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("automation_rules")
      .update({ is_enabled: enabled })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/automations");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

export async function upsertRuleAction(
  _prev: RuleResult | null,
  fd: FormData,
): Promise<RuleResult> {
  try {
    await requireRole(["admin"]);
    const id = String(fd.get("id") ?? "") || null;
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || null;
    const trigger = String(fd.get("trigger") ?? "");
    const conditionsRaw = String(fd.get("conditions") ?? "{}");
    const actionsRaw = String(fd.get("actions") ?? "[]");
    const isEnabled = String(fd.get("is_enabled") ?? "on") === "on";

    if (!name) return { ok: false, error: "Name is required." };
    if (!(TRIGGERS as readonly string[]).includes(trigger)) {
      return { ok: false, error: "Invalid trigger." };
    }

    const conditions = parseJson<Record<string, string | number | null>>(
      conditionsRaw,
      {},
    );
    const actions = parseJson<Array<Record<string, unknown>>>(
      actionsRaw,
      [],
    );
    if (!Array.isArray(actions)) {
      return { ok: false, error: "Actions must be a JSON array." };
    }

    const supabase = createServiceRoleClient();
    if (id) {
      const { error } = await supabase
        .from("automation_rules")
        .update({
          name,
          description,
          trigger,
          conditions,
          actions,
          is_enabled: isEnabled,
        })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard/settings/automations");
      revalidatePath(`/dashboard/settings/automations/${id}`);
      return { ok: true, id };
    } else {
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({
          name,
          description,
          trigger,
          conditions,
          actions,
          is_enabled: isEnabled,
        })
        .select("id")
        .single();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "Insert failed." };
      }
      revalidatePath("/dashboard/settings/automations");
      redirect(`/dashboard/settings/automations/${data.id}`);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}

export async function deleteRuleAction(id: string): Promise<RuleResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/automations");
    redirect("/dashboard/settings/automations");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
