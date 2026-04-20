"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Resolve an unmatched `project` row by picking the correct client from
 * the suggestions list (or any client id). Creates the project using the
 * staged payload and marks the review row resolved.
 */
export async function resolveProjectRowAction(
  reviewId: string,
  clientId: string,
): Promise<ReviewResult> {
  try {
    const actor = await requireUser();
    await requireRole(["admin", "office"]);
    if (!clientId) return { ok: false, error: "Pick a client first." };
    const supabase = createServiceRoleClient();
    const { data: row } = await supabase
      .from("import_review_rows")
      .select("id, kind, payload, status")
      .eq("id", reviewId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Review row not found." };
    if (row.status !== "pending") {
      return { ok: false, error: "Row already handled." };
    }
    if (row.kind !== "project") {
      return {
        ok: false,
        error: `Unsupported kind for this action: ${row.kind}.`,
      };
    }

    const payload = row.payload as {
      client_name?: string | null;
      name?: string;
      external_id?: string | null;
      scheduled_start?: string | null;
      completed_at?: string | null;
      revenue_cached?: number | null;
      service_address?: string | null;
      created_at?: string | null;
    };

    if (!payload.name) {
      return { ok: false, error: "Staged payload missing project name." };
    }

    const insertPayload: Record<string, unknown> = {
      client_id: clientId,
      name: payload.name,
      external_id: payload.external_id,
      scheduled_start: payload.scheduled_start,
      completed_at: payload.completed_at,
      revenue_cached: payload.revenue_cached,
      service_address: payload.service_address,
      location: payload.service_address,
      status: payload.completed_at ? "done" : "lead",
    };
    if (payload.created_at) insertPayload.created_at = payload.created_at;

    const { data: inserted, error: insErr } = await supabase
      .from("projects")
      .insert(insertPayload)
      .select("id")
      .single();
    if (insErr || !inserted) {
      return {
        ok: false,
        error: insErr?.message ?? "Failed to insert project.",
      };
    }

    await supabase
      .from("import_review_rows")
      .update({
        status: "resolved",
        resolved_entity_type: "project",
        resolved_entity_id: inserted.id,
        resolved_by: actor.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    revalidatePath("/dashboard/settings/import-review");
    revalidatePath("/dashboard/projects");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

/**
 * Resolve an unmatched `quote` row by picking the right client. Creates a
 * placeholder `projects` row under that client (or reuses one that
 * already exists for the client), then inserts the quote pointing at it.
 * Used for rows staged by the quotes importer when neither an exact
 * project nor a close client match was found.
 */
export async function resolveQuoteRowAction(
  reviewId: string,
  clientId: string,
): Promise<ReviewResult> {
  try {
    const actor = await requireUser();
    await requireRole(["admin", "office"]);
    if (!clientId) return { ok: false, error: "Pick a client first." };
    const supabase = createServiceRoleClient();
    const { data: row } = await supabase
      .from("import_review_rows")
      .select("id, kind, payload, status")
      .eq("id", reviewId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Review row not found." };
    if (row.status !== "pending") {
      return { ok: false, error: "Row already handled." };
    }
    if (row.kind !== "quote") {
      return {
        ok: false,
        error: `Unsupported kind for this action: ${row.kind}.`,
      };
    }

    const payload = row.payload as {
      number?: string;
      title?: string | null;
      status?: "draft" | "sent" | "accepted" | "declined" | "expired";
      total?: number | null;
      deposit_amount?: number | null;
      approved_at?: string | null;
      created_at?: string | null;
    };

    if (!payload.number) {
      return { ok: false, error: "Staged payload missing quote number." };
    }

    // Reuse the most recent project for this client, or spin a placeholder.
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let projectId = existingProject?.id as string | undefined;
    if (!projectId) {
      const projInsert: Record<string, unknown> = {
        client_id: clientId,
        name:
          payload.title?.trim() ||
          `Imported quote ${payload.number} (no linked job)`,
        status: "lead",
      };
      if (payload.created_at) projInsert.created_at = payload.created_at;
      const { data: newProj, error: projErr } = await supabase
        .from("projects")
        .insert(projInsert)
        .select("id")
        .single();
      if (projErr || !newProj) {
        return {
          ok: false,
          error: projErr?.message ?? "Failed to create placeholder project.",
        };
      }
      projectId = newProj.id;
    }

    const acceptedTotal =
      payload.status === "accepted" ? payload.total ?? null : null;
    const quoteInsert: Record<string, unknown> = {
      project_id: projectId,
      number: payload.number,
      title: payload.title,
      status: payload.status ?? "draft",
      base_total: payload.total ?? 0,
      accepted_total: acceptedTotal,
      accepted_at:
        payload.status === "accepted" ? payload.approved_at ?? null : null,
      approved_at: payload.approved_at ?? null,
      deposit_amount: payload.deposit_amount ?? null,
    };
    if (payload.created_at) quoteInsert.created_at = payload.created_at;

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert(quoteInsert)
      .select("id")
      .single();
    if (qErr || !quote) {
      return {
        ok: false,
        error: qErr?.message ?? "Failed to insert quote.",
      };
    }

    await supabase
      .from("import_review_rows")
      .update({
        status: "resolved",
        resolved_entity_type: "quote",
        resolved_entity_id: quote.id,
        resolved_by: actor.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    revalidatePath("/dashboard/settings/import-review");
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/projects");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function dismissReviewRowAction(
  reviewId: string,
): Promise<ReviewResult> {
  try {
    const actor = await requireUser();
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("import_review_rows")
      .update({
        status: "dismissed",
        resolved_by: actor.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reviewId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/import-review");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
