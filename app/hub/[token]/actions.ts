"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { loadHubClient } from "@/lib/hub";
import { storageKeyFor } from "@/lib/attachments";

export type HubActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendHubMessageAction(
  token: string,
  _prev: HubActionResult | null,
  fd: FormData
): Promise<HubActionResult> {
  const client = await loadHubClient(token);
  if (!client) return { ok: false, error: "Invalid hub link." };
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Message can't be empty." };
  if (body.length > 2000)
    return { ok: false, error: "Message too long (2000 char max)." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("communications").insert({
    client_id: client.id,
    direction: "inbound",
    channel: "sms",
    phone_number: client.phone ?? "hub",
    started_at: new Date().toISOString(),
    body,
  });
  if (error) {
    console.error("[hub] message insert failed", error);
    return { ok: false, error: "Couldn't send right now — try again." };
  }

  // Notify office that a new message arrived — in-app row + web push.
  const { data: officers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "office"]);
  const { notifyUsers } = await import("@/lib/notify");
  await notifyUsers(
    {
      userIds: (officers ?? []).map((o) => o.id as string),
      kind: "new_message",
      title: `New message from ${client.name}`,
      body: body.slice(0, 120),
      link: `/dashboard/clients/${client.id}`,
      entity_type: "client",
      entity_id: client.id,
    },
    supabase,
  );

  revalidatePath(`/hub/${token}`);
  return { ok: true };
}

export async function uploadHubFileAction(
  token: string,
  _prev: HubActionResult | null,
  fd: FormData
): Promise<HubActionResult> {
  const client = await loadHubClient(token);
  if (!client) return { ok: false, error: "Invalid hub link." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Pick a file first." };
  if (file.size > 25 * 1024 * 1024)
    return { ok: false, error: "File too large (25 MB max)." };

  const supabase = createServiceRoleClient();
  const key = storageKeyFor("client", client.id, file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("attachments")
    .upload(key, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    console.error("[hub] upload failed", upErr);
    return { ok: false, error: "Upload failed — try again." };
  }
  const { error: rowErr } = await supabase.from("attachments").insert({
    entity_type: "client",
    entity_id: client.id,
    storage_key: key,
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: bytes.length,
    caption: "Uploaded via client hub",
  });
  if (rowErr) {
    await supabase.storage.from("attachments").remove([key]);
    console.error("[hub] attachment row insert failed", rowErr);
    return { ok: false, error: "Upload saved but not recorded — tell Ronnie." };
  }

  revalidatePath(`/hub/${token}`);
  return { ok: true };
}
