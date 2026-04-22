"use server";

/**
 * Quick-schedule a workflow step — sets the step's due_date and
 * creates a visit on the project's schedule at the chosen time.
 * Designed to run in under 30 seconds on mobile: Ronnie taps a step
 * → picks date + time → one "Schedule" button.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type QuickScheduleResult =
  | { ok: true; visitId: string }
  | { ok: false; error: string };

export async function quickScheduleStepAction(
  stepId: string,
  date: string,
  time: string,
  assigneeId?: string | null,
): Promise<QuickScheduleResult> {
  try {
    await requireRole(["admin", "office"]);
    if (!date) return { ok: false, error: "Pick a date." };
    if (!time) return { ok: false, error: "Pick a time." };
    // Construct local-ish ISO — browser sent HH:MM in user's tz;
    // we store it as naive local and let Postgres' timestamptz
    // coerce based on server tz. Acceptable fuzz for visit
    // scheduling (not payroll).
    const iso = new Date(`${date}T${time}:00`).toISOString();

    const supabase = createServiceRoleClient();
    const { data: step, error: stepErr } = await supabase
      .from("project_workflow_steps")
      .select("id, project_id, title, description")
      .eq("id", stepId)
      .maybeSingle();
    if (stepErr || !step) {
      return { ok: false, error: stepErr?.message ?? "Step not found." };
    }

    // 1. Stamp the step's due_date + status.
    const { error: upErr } = await supabase
      .from("project_workflow_steps")
      .update({
        due_date: date,
        status: "in_progress",
        in_progress_since: new Date().toISOString(),
        assigned_to: assigneeId ?? null,
      })
      .eq("id", stepId);
    if (upErr) return { ok: false, error: upErr.message };

    // 2. Create the visit.
    const { data: visit, error: vErr } = await supabase
      .from("visits")
      .insert({
        project_id: step.project_id,
        scheduled_for: iso,
        duration_min: 240, // 4h default — Ronnie can resize on schedule
        status: "scheduled",
        notes: `${step.title}${step.description ? ` — ${step.description}` : ""}`,
      })
      .select("id")
      .single();
    if (vErr || !visit) {
      return { ok: false, error: vErr?.message ?? "Visit create failed." };
    }

    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: step.project_id,
      action: "workflow_step_scheduled",
      payload: {
        step_id: stepId,
        step_title: step.title,
        visit_id: visit.id,
        scheduled_for: iso,
      },
    });

    revalidatePath(`/dashboard/projects/${step.project_id}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/schedule");
    return { ok: true, visitId: visit.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
