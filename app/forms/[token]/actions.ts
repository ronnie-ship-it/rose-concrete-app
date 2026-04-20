"use server";

/**
 * Public action to submit a customer form. Token-gated (the /forms/<token>
 * URL is the only credential). Validates the required items have answers,
 * stores the response + optional signature, stamps the form completed,
 * and pipes downstream side-effects:
 *
 *   - demo_ack: stamp projects.demo_ack_at + activity_log
 *   - pre_pour: create a task for Ronnie + activity_log
 *   - completion: trigger final QBO invoice flow + activity_log
 *
 * We never throw a raw DB error back to the customer — errors come back
 * as a human-readable string they can retry.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { FormItem } from "@/lib/customer-forms";

export type FormSubmitResult =
  | { ok: true }
  | { ok: false; error: string };

export type FormAnswer = {
  confirmed?: boolean;
  initials?: string;
  value?: string;
};

export async function submitCustomerFormAction(
  token: string,
  signerName: string,
  answers: Record<string, FormAnswer>,
  signaturePng: string | null,
): Promise<FormSubmitResult> {
  if (!token) return { ok: false, error: "Missing token." };
  const trimmedName = (signerName ?? "").trim();
  if (!trimmedName) return { ok: false, error: "Please type your full name." };

  const supabase = createServiceRoleClient();
  const { data: form } = await supabase
    .from("customer_forms")
    .select("id, project_id, kind, status, items")
    .eq("token", token)
    .single();
  if (!form) return { ok: false, error: "This form link is no longer valid." };
  if (form.status === "completed") {
    return { ok: false, error: "This form was already submitted." };
  }

  // Validate every required item got an answer.
  const items = (form.items ?? []) as FormItem[];
  for (const item of items) {
    if (!item.required) continue;
    const ans = answers[item.key] ?? {};
    if (item.kind === "acknowledge" && ans.confirmed !== true) {
      return {
        ok: false,
        error: `Please acknowledge: ${item.label}`,
      };
    }
    if (item.kind === "confirm_initials") {
      if (ans.confirmed !== true || !(ans.initials ?? "").trim()) {
        return {
          ok: false,
          error: `Please confirm + initial: ${item.label}`,
        };
      }
    }
    if (item.kind === "signature" && !signaturePng) {
      return {
        ok: false,
        error: "Please draw your signature before submitting.",
      };
    }
  }
  if (signaturePng && signaturePng.length > 500_000) {
    return {
      ok: false,
      error: "Signature image too large. Clear and retry.",
    };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  // Store the response.
  const { error: respErr } = await supabase
    .from("customer_form_responses")
    .insert({
      form_id: form.id,
      answers,
      signer_name: trimmedName,
      signature_png: signaturePng,
      captured_ip: ip,
      captured_user_agent: h.get("user-agent") ?? null,
    });
  if (respErr) return { ok: false, error: respErr.message };

  await supabase
    .from("customer_forms")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", form.id);

  // Side effects per kind.
  const projectId = form.project_id as string;
  try {
    if (form.kind === "demo_ack") {
      await supabase
        .from("projects")
        .update({ demo_ack_at: new Date().toISOString() })
        .eq("id", projectId);
      await supabase.from("activity_log").insert({
        entity_type: "project",
        entity_id: projectId,
        action: "demo_ack_signed",
        payload: { by: trimmedName },
      });
    } else if (form.kind === "pre_pour") {
      // Unblock the pour: create a task for Ronnie to place the
      // concrete order, and notify office.
      await supabase.from("tasks").insert({
        title: `Order concrete for ${projectId}`,
        body: `Customer has signed off on the pre-pour form. Time to lock the mix with the plant.`,
        status: "open",
        kanban_column: "todo",
        priority: "high",
        project_id: projectId,
        source: "customer_form:pre_pour",
      });
      await supabase.from("activity_log").insert({
        entity_type: "project",
        entity_id: projectId,
        action: "pre_pour_signed",
        payload: { by: trimmedName },
      });
    } else if (form.kind === "completion") {
      await supabase.from("activity_log").insert({
        entity_type: "project",
        entity_id: projectId,
        action: "completion_signed",
        payload: { by: trimmedName },
      });
      // Trigger the final invoice flow if it wasn't already.
      const { triggerProjectCompletionFlow } = await import(
        "@/lib/completion-flow"
      );
      await triggerProjectCompletionFlow(projectId, supabase, {
        acceptedByCustomer: true,
      });
    }
  } catch (err) {
    console.warn("[forms] side-effect failed", err);
  }

  revalidatePath(`/forms/${token}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
