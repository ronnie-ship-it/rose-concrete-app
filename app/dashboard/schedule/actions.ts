"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

const VisitSchema = z.object({
  project_id: z.string().uuid("Pick a project"),
  scheduled_for: z.string().min(1, "Pick a date and time"),
  duration_min: z.coerce.number().int().min(15).max(8 * 60).default(60),
  is_placeholder: z.union([z.literal("on"), z.literal("")]).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  assigned: z.array(z.string().uuid()).optional().default([]),
});

export type VisitState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

function parseVisit(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const assigned = formData.getAll("assigned").map(String);
  return VisitSchema.safeParse({ ...raw, assigned });
}

async function syncAssignments(visitId: string, userIds: string[]) {
  const supabase = await createClient();
  await supabase.from("visit_assignments").delete().eq("visit_id", visitId);
  if (userIds.length > 0) {
    await supabase
      .from("visit_assignments")
      .insert(userIds.map((user_id) => ({ visit_id: visitId, user_id })));
  }
}

export async function createVisitAction(
  _prev: VisitState,
  formData: FormData
): Promise<VisitState> {
  await requireRole(["admin", "office"]);
  const parsed = parseVisit(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .insert({
      project_id: parsed.data.project_id,
      scheduled_for: parsed.data.scheduled_for,
      duration_min: parsed.data.duration_min,
      is_placeholder: parsed.data.is_placeholder === "on",
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await syncAssignments(data.id, parsed.data.assigned);

  revalidatePath("/dashboard/schedule");
  redirect(`/dashboard/schedule/${data.id}`);
}

export async function updateVisitAction(
  id: string,
  _prev: VisitState,
  formData: FormData
): Promise<VisitState> {
  await requireRole(["admin", "office"]);
  const parsed = parseVisit(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("visits")
    .update({
      project_id: parsed.data.project_id,
      scheduled_for: parsed.data.scheduled_for,
      duration_min: parsed.data.duration_min,
      is_placeholder: parsed.data.is_placeholder === "on",
      notes: parsed.data.notes || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await syncAssignments(id, parsed.data.assigned);
  revalidatePath("/dashboard/schedule");
  revalidatePath(`/dashboard/schedule/${id}`);
  return { ok: true };
}

export async function deleteVisitAction(id: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase.from("visits").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/schedule");
  redirect("/dashboard/schedule");
}

export type OnMyWayState =
  | null
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Fire a pre-baked "Ronnie is heading your way, ETA X min" SMS to the
 * client on record for a visit. Uses the OpenPhone adapter (stubbed
 * today; wires in automatically once OPENPHONE_API_KEY lands) and
 * writes an `activity_log` row with action='on_my_way_sent' either way
 * — the adapter's skip result is a soft signal, not an error, so Ronnie
 * sees confirmation and a log entry regardless.
 */
export async function sendOnMyWayAction(
  visitId: string,
  etaMinutes: number
): Promise<OnMyWayState> {
  await requireRole(["admin", "office", "crew"]);
  const actor = await requireUser();

  const eta = Math.max(5, Math.min(240, Math.round(etaMinutes)));
  const supabase = await createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select(
      `id, scheduled_for,
       project:projects(
         id, name,
         client:clients(id, name, phone)
       )`
    )
    .eq("id", visitId)
    .single();
  if (error || !visit) {
    return { ok: false, error: "Visit not found." };
  }

  const project = Array.isArray(visit.project) ? visit.project[0] : visit.project;
  const client = project?.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;
  if (!client?.phone) {
    return {
      ok: false,
      error: "No phone number on file for this client.",
    };
  }
  const phone = normalizePhone(client.phone);
  if (!phone) {
    return { ok: false, error: `Couldn't parse phone "${client.phone}".` };
  }

  const firstName = (client.name ?? "").split(/\s+/)[0] || "there";
  const body =
    `Hi ${firstName} — this is Ronnie with Rose Concrete. ` +
    `I'm headed your way now, ETA about ${eta} minutes. ` +
    `Text this number back if anything changes.`;

  const adapter = getOpenPhoneAdapter();
  const res = await adapter.sendMessage(phone, body);

  await supabase.from("activity_log").insert({
    entity_type: "visit",
    entity_id: visitId,
    action: "on_my_way_sent",
    actor_id: actor.id,
    payload: {
      phone,
      eta_minutes: eta,
      body,
      delivery: res.ok
        ? { ok: true, external_id: res.external_id }
        : { ok: false, error: res.error, skip: res.skip },
    },
  });

  revalidatePath(`/dashboard/schedule/${visitId}`);

  if (res.ok) {
    return { ok: true, message: `On-my-way text sent to ${firstName}.` };
  }
  if (res.skip) {
    return {
      ok: true,
      message: `Logged (OpenPhone not wired yet — no SMS sent).`,
    };
  }
  return { ok: false, error: res.error };
}

export async function markVisitCompleteAction(id: string): Promise<void> {
  // Crew can also call this — they're allowed to update visits assigned to them
  // (RLS policy), so we don't enforce admin/office here.
  const supabase = await createClient();
  await supabase
    .from("visits")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/dashboard/schedule");
  revalidatePath(`/dashboard/schedule/${id}`);
  revalidatePath("/crew");
}
