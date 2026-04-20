"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

export type ReplyResult =
  | { ok: true }
  | { ok: false; error: string; skip?: boolean };

export async function sendReplyAction(
  clientId: string,
  _prev: ReplyResult | null,
  fd: FormData
): Promise<ReplyResult> {
  await requireRole(["admin", "office"]);
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Empty message." };
  if (body.length > 1600)
    return { ok: false, error: "Message too long (1600 chars / 10 SMS)." };

  const supabase = createServiceRoleClient();
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id, phone")
    .eq("id", clientId)
    .maybeSingle();
  if (cErr || !client) return { ok: false, error: "Client not found." };
  const phone = normalizePhone(client.phone);
  if (!phone) {
    return {
      ok: false,
      error: "Client has no valid phone number on file.",
    };
  }

  const adapter = getOpenPhoneAdapter();
  const send = await adapter.sendMessage(phone, body);
  if (!send.ok) {
    // Store as a failed outbound anyway so the office has a record.
    await supabase.from("communications").insert({
      client_id: clientId,
      direction: "outbound",
      channel: "sms",
      phone_number: phone,
      started_at: new Date().toISOString(),
      body,
    });
    return { ok: false, error: send.error, skip: send.skip };
  }

  await supabase.from("communications").insert({
    client_id: clientId,
    external_id: send.external_id,
    direction: "outbound",
    channel: "sms",
    phone_number: phone,
    started_at: new Date().toISOString(),
    body,
  });

  revalidatePath(`/dashboard/messages/${clientId}`);
  revalidatePath("/dashboard/messages");
  return { ok: true };
}

export async function markThreadReadAction(clientId: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = createServiceRoleClient();
  await supabase
    .from("communications")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("read_at", null)
    .eq("direction", "inbound");
  revalidatePath("/dashboard/messages");
}
