"use server";

/**
 * Server actions for the Phase Timeline on the project detail page.
 *
 *   - seedPhasesAction       — creates the 5 default phases (idempotent).
 *   - updatePhaseAction      — patches dates / status / notes. When a
 *                              phase gets scheduled, also rebuilds the
 *                              SMS draft body + recipients.
 *   - sendPhaseTextAction    — fires the drafted SMS via OpenPhone.
 *                              Records sent_at + sent_by, writes an
 *                              activity_log row, and touches the phase.
 *   - completePhaseAction    — marks phase done and, if it was the
 *                              last phase, kicks off the completion
 *                              flow (completion form + final QBO invoice).
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  seedDefaultPhases,
  buildPhaseText,
  type PhaseRow,
  type PhaseStatus,
} from "@/lib/phases";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

export type PhaseResult = { ok: true } | { ok: false; error: string };

export async function seedPhasesAction(
  projectId: string,
): Promise<PhaseResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    await seedDefaultPhases(projectId, supabase);
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

async function loadPhaseContext(
  supabase: ReturnType<typeof createServiceRoleClient>,
  phaseId: string,
) {
  const { data: phase } = await supabase
    .from("project_phases")
    .select("*, project:projects!inner(id, name, location, service_address, service_type, client:clients(id, name))")
    .eq("id", phaseId)
    .single();
  if (!phase) return null;
  const project = Array.isArray(phase.project) ? phase.project[0] : phase.project;
  const client = project?.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;
  const { data: business } = await supabase
    .from("business_profile")
    .select(
      "welcome_video_url, phase_text_demo, phase_text_prep, phase_text_pour, phase_text_cleanup, phase_to_demo, phase_to_pour",
    )
    .limit(1)
    .maybeSingle();
  return { phase: phase as PhaseRow & Record<string, unknown>, project, client, business };
}

export async function updatePhaseAction(
  phaseId: string,
  patch: {
    start_date?: string | null;
    end_date?: string | null;
    status?: PhaseStatus;
    notes?: string;
    label?: string;
  },
): Promise<PhaseResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const ctx = await loadPhaseContext(supabase, phaseId);
    if (!ctx) return { ok: false, error: "Phase not found." };

    // Apply the patch.
    const update: Record<string, unknown> = { ...patch };
    if (patch.status === "scheduled" && (patch.start_date || ctx.phase.start_date)) {
      // Rebuild draft when phase is (re-)scheduled or date changes.
    }
    const { data: updated, error } = await supabase
      .from("project_phases")
      .update(update)
      .eq("id", phaseId)
      .select("*")
      .single();
    if (error || !updated) {
      return {
        ok: false,
        error: error?.message ?? "Update failed.",
      };
    }

    // If this is a phase that has a template (demo/prep/pour/cleanup)
    // and dates are now set, regenerate the draft body + to-list so
    // the UI picks it up. Skip inspection/custom.
    const templated = ["demo", "prep", "pour", "cleanup"].includes(
      updated.kind as string,
    );
    if (templated && updated.start_date) {
      const address =
        (ctx.project?.service_address as string | null) ??
        (ctx.project?.location as string | null) ??
        "";
      const clientName = (ctx.client?.name as string | null) ?? "there";
      const { body, to } = await buildPhaseText(updated as PhaseRow, {
        clientName,
        address,
        serviceType: (ctx.project?.service_type as string | null) ?? null,
        business: ctx.business ?? null,
      });
      await supabase
        .from("project_phases")
        .update({ text_draft_body: body, text_draft_to: to })
        .eq("id", phaseId);
    }

    revalidatePath(`/dashboard/projects/${ctx.phase.project_id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/** Fire the drafted SMS for a phase. Admin/office only. */
export async function sendPhaseTextAction(
  phaseId: string,
  overrides?: { body?: string; to?: string },
): Promise<PhaseResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const ctx = await loadPhaseContext(supabase, phaseId);
    if (!ctx) return { ok: false, error: "Phase not found." };
    const body = (overrides?.body ?? ctx.phase.text_draft_body)?.trim();
    const toRaw = (overrides?.to ?? ctx.phase.text_draft_to) ?? "";
    const recipients = toRaw
      .split(/[,;\n]+/)
      .map((s) => normalizePhone(s.trim()))
      .filter((s): s is string => Boolean(s));
    if (!body) return { ok: false, error: "Nothing drafted to send." };
    if (recipients.length === 0) {
      return {
        ok: false,
        error: "No recipients — add phone numbers in Settings → Business profile.",
      };
    }

    const adapter = getOpenPhoneAdapter();
    const results: Array<{ ok: boolean; phone: string; error?: string }> = [];
    for (const phone of recipients) {
      const res = await adapter.sendMessage(phone, body);
      results.push({ ok: res.ok, phone, error: res.ok ? undefined : res.error });
    }
    const allOk = results.every((r) => r.ok);

    await supabase
      .from("project_phases")
      .update({
        text_sent_at: new Date().toISOString(),
        text_sent_by: user.id,
        text_draft_body: body,
        text_draft_to: recipients.join(", "),
      })
      .eq("id", phaseId);

    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: ctx.phase.project_id,
      action: `phase_${ctx.phase.kind}_text_sent`,
      payload: {
        phase_id: phaseId,
        recipients,
        all_ok: allOk,
        failures: results.filter((r) => !r.ok),
      },
    });

    revalidatePath(`/dashboard/projects/${ctx.phase.project_id}`);
    return allOk
      ? { ok: true }
      : {
          ok: false,
          error: `Some sends failed: ${results
            .filter((r) => !r.ok)
            .map((r) => `${r.phone} (${r.error})`)
            .join("; ")}`,
        };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/** Mark phase done. If it was the last phase, kick off completion flow. */
export async function completePhaseAction(
  phaseId: string,
): Promise<PhaseResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { data: phase } = await supabase
      .from("project_phases")
      .select("id, project_id, kind, sequence")
      .eq("id", phaseId)
      .single();
    if (!phase) return { ok: false, error: "Phase not found." };
    await supabase
      .from("project_phases")
      .update({ status: "done" })
      .eq("id", phaseId);

    // Check if every phase on the project is now done — if so, flip
    // the project to 'done' and trigger the completion flow.
    const { data: others } = await supabase
      .from("project_phases")
      .select("status")
      .eq("project_id", phase.project_id)
      .neq("status", "skipped");
    const allDone = (others ?? []).every((o) => o.status === "done");
    if (allDone) {
      // Lazy-import to avoid a circular hop at module load.
      const { triggerProjectCompletionFlow } = await import(
        "@/lib/completion-flow"
      );
      await triggerProjectCompletionFlow(phase.project_id as string, supabase);
    }

    revalidatePath(`/dashboard/projects/${phase.project_id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
