"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole, requireUser } from "@/lib/auth";
import {
  storageKeyFor,
  type AttachmentEntity,
} from "@/lib/attachments";

const ENTITY_TYPES = [
  "client",
  "project",
  "quote",
  "visit",
  "task",
  "permit",
] as const;

const UPLOAD_SCHEMA = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().uuid(),
  caption: z.string().trim().max(500).optional().or(z.literal("")),
});

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — covers permits, photos, short PDFs.

export type UploadResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Multipart upload action. Called from the AttachmentsPanel client form;
 * reads the `file` field directly off the FormData, pushes the blob to
 * Storage, then inserts the row. On any failure we try to clean up the
 * orphaned Storage object so we don't leak blobs.
 */
export async function uploadAttachmentAction(
  _prev: UploadResult | null,
  formData: FormData
): Promise<UploadResult> {
  await requireRole(["admin", "office"]);
  const actor = await requireUser();

  const parsed = UPLOAD_SCHEMA.safeParse({
    entity_type: formData.get("entity_type"),
    entity_id: formData.get("entity_id"),
    caption: formData.get("caption") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid upload target." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large (${Math.round(
        file.size / 1_000_000
      )} MB > 25 MB).`,
    };
  }

  const { entity_type, entity_id, caption } = parsed.data;
  const key = storageKeyFor(entity_type, entity_id, file.name);
  const supabase = createServiceRoleClient();

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("attachments")
    .upload(key, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    console.error("[uploadAttachment]", upErr);
    return { ok: false, error: `Storage upload failed: ${upErr.message}` };
  }

  const { error: insErr } = await supabase.from("attachments").insert({
    entity_type,
    entity_id,
    storage_key: key,
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    caption: caption === "" ? null : caption,
    uploaded_by: actor.id,
  });
  if (insErr) {
    // Roll back the Storage write so we don't leak.
    await supabase.storage.from("attachments").remove([key]);
    console.error("[uploadAttachment] insert", insErr);
    return { ok: false, error: `DB insert failed: ${insErr.message}` };
  }

  revalidateFor(entity_type as AttachmentEntity, entity_id);
  return { ok: true };
}

export async function deleteAttachmentAction(
  attachmentId: string
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = createServiceRoleClient();
  const { data: row, error: selErr } = await supabase
    .from("attachments")
    .select("id, entity_type, entity_id, storage_key")
    .eq("id", attachmentId)
    .single();
  if (selErr || !row) {
    throw new Error(selErr?.message ?? "Attachment not found");
  }
  // Remove Storage blob first; if that fails we abort so the row still
  // resolves to a real file.
  const { error: rmErr } = await supabase.storage
    .from("attachments")
    .remove([row.storage_key]);
  if (rmErr) {
    console.error("[deleteAttachment] storage rm", rmErr);
    throw new Error(`Storage delete failed: ${rmErr.message}`);
  }
  const { error: delErr } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);
  if (delErr) throw new Error(delErr.message);
  revalidateFor(row.entity_type as AttachmentEntity, row.entity_id);
}

export async function updateCaptionAction(
  attachmentId: string,
  caption: string
): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = createServiceRoleClient();
  const { data: row, error: selErr } = await supabase
    .from("attachments")
    .select("entity_type, entity_id")
    .eq("id", attachmentId)
    .single();
  if (selErr || !row) throw new Error(selErr?.message ?? "Not found");
  const trimmed = caption.trim().slice(0, 500);
  const { error } = await supabase
    .from("attachments")
    .update({ caption: trimmed === "" ? null : trimmed })
    .eq("id", attachmentId);
  if (error) throw new Error(error.message);
  revalidateFor(row.entity_type as AttachmentEntity, row.entity_id);
}

function revalidateFor(entityType: AttachmentEntity, entityId: string) {
  switch (entityType) {
    case "client":
      revalidatePath(`/dashboard/clients/${entityId}`);
      return;
    case "project":
      revalidatePath(`/dashboard/projects/${entityId}`);
      return;
    case "quote":
      revalidatePath(`/dashboard/quotes/${entityId}`);
      return;
    case "visit":
      revalidatePath(`/dashboard/schedule/${entityId}`);
      return;
    case "task":
    case "permit":
      // Tasks and permits currently live inside their parent project page,
      // so a broad revalidate is handled at the action site.
      return;
  }
}
