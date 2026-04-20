"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const RecordSchema = z.object({
  storage_key: z.string().min(1),
  project_id: z.string().uuid().optional().or(z.literal("")),
  caption: z.string().max(500).optional().or(z.literal("")),
  tags: z.string().max(500).optional().or(z.literal("")),
});

export type RecordPhotoState =
  | { ok: true; id: string }
  | { ok: false; error: string }
  | null;

/**
 * Creates a `photos` row pointing at an object the client just uploaded
 * directly to Supabase Storage. Called from the crew uploader after the
 * upload succeeds.
 */
export async function recordPhotoAction(
  _prev: RecordPhotoState,
  formData: FormData
): Promise<RecordPhotoState> {
  const user = await requireUser();
  const parsed = RecordSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const { storage_key, project_id, caption, tags } = parsed.data;
  const tagArray = (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      storage_key,
      project_id: project_id || null,
      caption: caption || null,
      tags: tagArray,
      uploaded_by: user.id,
      taken_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (project_id) revalidatePath(`/dashboard/projects/${project_id}`);
  revalidatePath("/crew/upload");
  return { ok: true, id: data.id };
}
