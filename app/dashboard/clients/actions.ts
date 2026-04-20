"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const ClientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(40).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  source: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type ClientFormState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return ClientSchema.safeParse(raw);
}

function nullify<T extends Record<string, unknown>>(obj: T): T {
  // Convert empty strings to null so the DB stores nothing instead of "".
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out as T;
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireRole(["admin", "office"]);
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join("."), i.message])
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert(nullify(parsed.data))
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${data.id}`);
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireRole(["admin", "office"]);
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join("."), i.message])
      ),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update(nullify(parsed.data))
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { ok: true };
}

export async function deleteClientAction(id: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

/**
 * Soft-delete — sets `archived_at` instead of removing the row so the
 * client's history (quotes, projects, invoices) stays reachable from
 * links and reports. The Clients list filters archived rows out by
 * default but an "Archived" tab surfaces them.
 *
 * Does NOT redirect — the caller (the client detail page) stays put
 * so Ronnie can still poke at the archived record if needed.
 */
export async function archiveClientAction(
  id: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: now, archived_reason: reason?.trim() || null })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    // Cascade: stamp every project + quote + lead that belongs to this
    // client so Jobber-style "archive this client and everything
    // underneath" works in one shot. Best-effort — individual cascades
    // aren't fatal to the main archive.
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", id);
    const projectIds = (projects ?? []).map((p) => p.id as string);

    if (projectIds.length > 0) {
      await supabase
        .from("projects")
        .update({ archived_at: now })
        .in("id", projectIds)
        .is("archived_at", null);
      await supabase
        .from("quotes")
        .update({ archived_at: now })
        .in("project_id", projectIds)
        .is("archived_at", null);
    }
    // Leads attach to clients via client_id — mark any pending lead
    // closed/archived too so it doesn't sit in the Requests queue.
    await supabase
      .from("leads")
      .update({ archived_at: now })
      .eq("client_id", id)
      .is("archived_at", null);

    await supabase.from("activity_log").insert({
      entity_type: "client",
      entity_id: id,
      action: "client_archived",
      payload: {
        reason: reason ?? null,
        cascaded_projects: projectIds.length,
      },
    });
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/requests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/**
 * Restore an archived client — clears archived_at on the client and
 * on every project / quote / lead that was cascaded in archiveClientAction.
 * We don't track whether individual children were archived before the
 * cascade; unarchiving the client unarchives everything underneath,
 * which matches the mental model ("I changed my mind, bring it all
 * back"). If Ronnie needs per-record archive later it's a separate
 * action.
 */
export async function unarchiveClientAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = await createClient();
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: null, archived_reason: null })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", id);
    const projectIds = (projects ?? []).map((p) => p.id as string);
    if (projectIds.length > 0) {
      await supabase
        .from("projects")
        .update({ archived_at: null })
        .in("id", projectIds);
      await supabase
        .from("quotes")
        .update({ archived_at: null })
        .in("project_id", projectIds);
    }
    await supabase
      .from("leads")
      .update({ archived_at: null })
      .eq("client_id", id);

    await supabase.from("activity_log").insert({
      entity_type: "client",
      entity_id: id,
      action: "client_unarchived",
      payload: {},
    });
    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/requests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
