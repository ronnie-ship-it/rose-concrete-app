/**
 * Project completion flow. Called in two places:
 *
 *   1. `completePhaseAction` — when the last phase is marked done.
 *   2. `submitCustomerFormAction` (kind = 'completion') — when the
 *      customer signs the completion form.
 *
 * Flow:
 *   - If the project isn't already flipped to 'done', flip it.
 *   - Ensure the completion customer_form exists + is sent (if we
 *     came from the phase side, the form goes out; if we came from
 *     the form side, it's already completed).
 *   - Generate / enable the final QBO invoice via the existing
 *     generateInvoiceForProjectAction (best effort).
 *   - Create a "Collect payment" task for Ronnie.
 *   - Fire an in-app notification + push.
 *
 * Idempotent — running it twice doesn't re-flip statuses or
 * double-task.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ensureCustomerForm } from "@/lib/customer-forms";

export async function triggerProjectCompletionFlow(
  projectId: string,
  supabase: SupabaseClient = createServiceRoleClient(),
  opts: { acceptedByCustomer?: boolean } = {},
): Promise<void> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, status, name, completed_at")
    .eq("id", projectId)
    .single();
  if (!project) return;

  const wasDone = project.status === "done";
  if (!wasDone) {
    await supabase
      .from("projects")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", projectId);
    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "project_completed",
      payload: { via: opts.acceptedByCustomer ? "customer_form" : "phase" },
    });
  }

  // Ensure a completion form row exists — so it's visible in admin
  // even if the customer hasn't signed yet.
  await ensureCustomerForm(projectId, "completion", {}, supabase);

  // Generate the final QBO invoice if one isn't already. The existing
  // `generateInvoiceForProjectAction` handles idempotency — it no-ops
  // if qbo_invoice_id is set.
  try {
    const { generateInvoiceForProjectAction } = await import(
      "@/app/dashboard/projects/actions"
    );
    await generateInvoiceForProjectAction(projectId);
  } catch (err) {
    console.warn("[completion] QBO invoice generation threw", err);
  }

  // Create a "collect final payment" task if we don't already have one
  // open for this project.
  const { data: existingTask } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId)
    .eq("source", "completion:collect_payment")
    .in("status", ["open", "in_progress"])
    .limit(1);
  if (!existingTask || existingTask.length === 0) {
    await supabase.from("tasks").insert({
      title: `Collect final payment — ${project.name}`,
      body: `Job is wrapped. Send the invoice with payment options (check / ACH / card) and follow up until paid.`,
      status: "open",
      kanban_column: "todo",
      priority: "high",
      project_id: projectId,
      source: "completion:collect_payment",
    });
  }

  // Notify office (in-app + push) that the job completed.
  try {
    const { notifyUsers } = await import("@/lib/notify");
    const { data: officers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "office"]);
    await notifyUsers(
      {
        userIds: (officers ?? []).map((o) => o.id as string),
        kind: "job_completed",
        title: `Job completed: ${project.name}`,
        body: opts.acceptedByCustomer
          ? "Customer has signed the completion form."
          : "All phases are done — send the final invoice.",
        link: `/dashboard/projects/${projectId}`,
        entity_type: "project",
        entity_id: projectId,
      },
      supabase,
    );
  } catch (err) {
    console.warn("[completion] notify failed", err);
  }
}
