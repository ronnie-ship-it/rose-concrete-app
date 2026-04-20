"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole, requireUser } from "@/lib/auth";
import {
  addBusinessDays,
  canStartStep,
  type ProjectWorkflowStep,
} from "@/lib/workflows";

const UpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "done", "skipped"]).optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowStepResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Update a workflow step. Enforces dependency gating: a step can only
 * move to `in_progress` or `done` if its predecessor is already
 * `done`/`skipped`. When a step flips to `done`, we open the next
 * dependent step (set status=in_progress, stamp in_progress_since, seed
 * due_date from SLA).
 */
export async function updateWorkflowStepAction(
  projectId: string,
  stepId: string,
  input: z.infer<typeof UpdateSchema>
): Promise<WorkflowStepResult> {
  await requireRole(["admin", "office"]);
  const actor = await requireUser();
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const supabase = createServiceRoleClient();

  const { data: steps, error: loadErr } = await supabase
    .from("project_workflow_steps")
    .select("*")
    .eq("project_id", projectId)
    .order("sequence");
  if (loadErr || !steps) {
    return { ok: false, error: loadErr?.message ?? "No steps" };
  }
  const step = (steps as ProjectWorkflowStep[]).find((s) => s.id === stepId);
  if (!step) return { ok: false, error: "Step not found" };

  const update: Record<string, unknown> = {};
  const nextStatus = parsed.data.status;

  if (nextStatus && nextStatus !== step.status) {
    if (
      (nextStatus === "in_progress" || nextStatus === "done") &&
      step.status === "pending"
    ) {
      const gate = canStartStep(step, steps as ProjectWorkflowStep[]);
      if (!gate.ok) return { ok: false, error: gate.reason };
    }
    update.status = nextStatus;
    if (nextStatus === "in_progress" && !step.in_progress_since) {
      update.in_progress_since = new Date().toISOString();
    }
    if (nextStatus === "done") {
      update.completed_at = new Date().toISOString();
      update.completed_by = actor.id;
    }
    if (nextStatus === "pending") {
      update.in_progress_since = null;
      update.completed_at = null;
      update.completed_by = null;
    }
  }

  if (parsed.data.due_date !== undefined) {
    update.due_date = parsed.data.due_date === "" ? null : parsed.data.due_date;
  }
  if (parsed.data.assigned_to !== undefined) {
    update.assigned_to =
      parsed.data.assigned_to === "" ? null : parsed.data.assigned_to;
  }
  if (parsed.data.notes !== undefined) {
    update.notes = parsed.data.notes === "" ? null : parsed.data.notes;
  }
  if (parsed.data.metadata !== undefined) {
    // Merge rather than replace — keeps prior fields (submission_date,
    // permit_number) when the UI only edits one of them.
    update.metadata = { ...step.metadata, ...parsed.data.metadata };
  }

  const { error: updErr } = await supabase
    .from("project_workflow_steps")
    .update(update)
    .eq("id", stepId);
  if (updErr) return { ok: false, error: updErr.message };

  // When this step closed, auto-open the next dependent step.
  if (nextStatus === "done") {
    const next = (steps as ProjectWorkflowStep[]).find(
      (s) => s.depends_on_sequence === step.sequence
    );
    if (next && next.status === "pending") {
      const dueDate =
        next.sla_business_days != null
          ? addBusinessDays(new Date(), next.sla_business_days)
              .toISOString()
              .slice(0, 10)
          : null;
      await supabase
        .from("project_workflow_steps")
        .update({
          status: "in_progress",
          in_progress_since: new Date().toISOString(),
          due_date: dueDate,
        })
        .eq("id", next.id);
    }
    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "workflow_step_completed",
      actor_id: actor.id,
      payload: {
        step_id: stepId,
        sequence: step.sequence,
        title: step.title,
      },
    });
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/workflows");
  return { ok: true };
}
