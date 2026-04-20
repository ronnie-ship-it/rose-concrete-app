"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { storageKeyFor } from "@/lib/attachments";

export type ChangeOrderResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

async function nextChangeOrderNumber(
  supabase: ReturnType<typeof createServiceRoleClient>,
  projectId: string,
): Promise<number> {
  const { data } = await supabase
    .from("change_orders")
    .select("number")
    .eq("project_id", projectId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.number as number | undefined) ?? 0) + 1;
}

export async function createChangeOrderAction(
  _prev: ChangeOrderResult | null,
  fd: FormData,
): Promise<ChangeOrderResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    const projectId = String(fd.get("project_id") ?? "");
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || null;
    const additionalCost = Number(fd.get("additional_cost") ?? 0);
    const additionalDays = Number(fd.get("additional_days") ?? 0);
    if (!projectId) return { ok: false, error: "Project is required." };
    if (!title) return { ok: false, error: "Title is required." };

    const supabase = createServiceRoleClient();
    const number = await nextChangeOrderNumber(supabase, projectId);
    const { data, error } = await supabase
      .from("change_orders")
      .insert({
        project_id: projectId,
        number,
        title,
        description,
        additional_cost: Number.isFinite(additionalCost) ? additionalCost : 0,
        additional_days: Number.isFinite(additionalDays) ? additionalDays : 0,
        status: "draft",
        created_by: user.id,
        public_token: randomToken(),
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to create." };
    }
    revalidatePath("/dashboard/change-orders");
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create.",
    };
  }
}

export async function updateChangeOrderStatusAction(
  id: string,
  status: "draft" | "sent" | "signed" | "rejected",
): Promise<ChangeOrderResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("change_orders")
      .update({ status })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/change-orders");
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update.",
    };
  }
}

export type SignResult = { ok: true } | { ok: false; error: string };

/**
 * Public-facing signature endpoint — used by the customer via the
 * `/change-order/<token>` page. No role check; the token is the auth.
 */
export async function signChangeOrderAction(
  token: string,
  signedName: string,
  signatureDataUrl: string,
): Promise<SignResult> {
  try {
    if (!token || !signedName.trim() || !signatureDataUrl) {
      return { ok: false, error: "Missing fields." };
    }
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("change_orders")
      .update({
        status: "signed",
        signed_name: signedName.trim(),
        signed_at: new Date().toISOString(),
        signature_data_url: signatureDataUrl,
      })
      .eq("public_token", token);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to sign.",
    };
  }
}

export async function uploadChangeOrderPhotoAction(
  changeOrderId: string,
  fd: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Pick a photo." };
    }
    if (file.size > 25 * 1024 * 1024) {
      return { ok: false, error: "File too large (max 25MB)." };
    }
    const supabase = createServiceRoleClient();
    const key = storageKeyFor("task", changeOrderId, file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("attachments")
      .upload(key, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) return { ok: false, error: upErr.message };
    const { error: insErr } = await supabase.from("attachments").insert({
      entity_type: "task",
      entity_id: changeOrderId,
      storage_key: key,
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      caption: "change_order_photo",
      uploaded_by: user.id,
    });
    if (insErr) {
      await supabase.storage.from("attachments").remove([key]);
      return { ok: false, error: insErr.message };
    }
    revalidatePath(`/dashboard/change-orders/${changeOrderId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}
