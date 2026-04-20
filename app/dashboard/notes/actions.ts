"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { NoteEntity, NoteKind } from "@/lib/notes";

/**
 * Server actions for the polymorphic notes table. Each action takes the
 * entity type + id so we can revalidate the right detail page.
 */

const REVALIDATE_PATH: Record<NoteEntity, (id: string) => string> = {
  client: (id) => `/dashboard/clients/${id}`,
  project: (id) => `/dashboard/projects/${id}`,
  quote: (id) => `/dashboard/quotes/${id}`,
  visit: (id) => `/dashboard/schedule`,
};

export type NoteResult = { ok: true } | { ok: false; error: string };

export async function createNote(
  entityType: NoteEntity,
  entityId: string,
  _prev: NoteResult | null,
  formData: FormData
): Promise<NoteResult> {
  await requireRole(["admin", "office"]);
  const body = String(formData.get("body") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "internal") || "internal") as NoteKind;
  if (!body) return { ok: false, error: "Note body cannot be empty." };
  if (body.length > 5000)
    return { ok: false, error: "Note is too long (max 5000 chars)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("notes").insert({
    entity_type: entityType,
    entity_id: entityId,
    kind,
    body,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE_PATH[entityType](entityId));
  return { ok: true };
}

export async function togglePinNote(
  entityType: NoteEntity,
  entityId: string,
  noteId: string,
  pinned: boolean
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  await supabase.from("notes").update({ is_pinned: pinned }).eq("id", noteId);
  revalidatePath(REVALIDATE_PATH[entityType](entityId));
}

export async function deleteNote(
  entityType: NoteEntity,
  entityId: string,
  noteId: string
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(REVALIDATE_PATH[entityType](entityId));
}
