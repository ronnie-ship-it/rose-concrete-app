"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type FormActionResult =
  | { ok: true; instanceId: string }
  | { ok: false; error: string };

/**
 * Create a job_form_instance for a project or visit from a template, or
 * return the existing one. Crew taps "Fill out pre-inspection" on a visit
 * and we either reopen the existing in-progress instance or spawn a new one.
 */
export async function ensureFormInstanceAction(
  templateId: string,
  projectId: string | null,
  visitId: string | null,
): Promise<FormActionResult> {
  try {
    await requireRole(["admin", "office", "crew"]);
    const supabase = createServiceRoleClient();
    // Look for an existing in-progress / pending instance first.
    let existingQuery = supabase
      .from("job_form_instances")
      .select("id")
      .eq("template_id", templateId)
      .in("status", ["pending", "in_progress"]);
    if (projectId) existingQuery = existingQuery.eq("project_id", projectId);
    if (visitId) existingQuery = existingQuery.eq("visit_id", visitId);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) return { ok: true, instanceId: existing.id };

    const { data, error } = await supabase
      .from("job_form_instances")
      .insert({
        template_id: templateId,
        project_id: projectId,
        visit_id: visitId,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed." };
    }
    return { ok: true, instanceId: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function submitFormInstanceAction(
  instanceId: string,
  responses: Record<string, unknown>,
): Promise<FormActionResult> {
  try {
    const user = await requireRole(["admin", "office", "crew"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("job_form_instances")
      .update({
        responses,
        status: "completed",
        completed_by: user.id,
        completed_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
      })
      .eq("id", instanceId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/crew");
    return { ok: true, instanceId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to submit.",
    };
  }
}

export async function saveFormInstanceAction(
  instanceId: string,
  responses: Record<string, unknown>,
): Promise<FormActionResult> {
  try {
    await requireRole(["admin", "office", "crew"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("job_form_instances")
      .update({
        responses,
        status: "in_progress",
      })
      .eq("id", instanceId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, instanceId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save.",
    };
  }
}
