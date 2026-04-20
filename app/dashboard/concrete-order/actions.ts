"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

export type OrderActionResult =
  | { ok: true; id: string; sent: number; failed: number; skipped: boolean }
  | { ok: false; error: string };

/**
 * Concrete orders get blasted out to a pre-configured group (Willy / Roger /
 * Michael by default). This action persists a structured record, then fans
 * out one OpenPhone SMS per recipient. It treats OpenPhone-not-wired as a
 * soft skip — the record saves with status='draft' so it's still visible.
 */
export async function sendConcreteOrderAction(
  _prev: OrderActionResult | null,
  fd: FormData,
): Promise<OrderActionResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    const projectId = String(fd.get("project_id") ?? "") || null;
    const pourDate = String(fd.get("pour_date") ?? "") || null;
    const pourTime = String(fd.get("pour_time") ?? "") || null;
    const yards = String(fd.get("yards") ?? "") || null;
    const psi = String(fd.get("psi") ?? "") || null;
    const slump = String(fd.get("slump") ?? "") || null;
    const mixNotes = String(fd.get("mix_notes") ?? "") || null;
    const deliveryAddress = String(fd.get("delivery_address") ?? "") || null;
    const siteContact = String(fd.get("site_contact") ?? "") || null;
    const sitePhone = String(fd.get("site_phone") ?? "") || null;
    const messageBody = String(fd.get("message_body") ?? "").trim();
    const recipientIdsStr = String(fd.get("recipient_ids") ?? "");
    const sendNow = String(fd.get("send_now") ?? "") === "1";

    if (!messageBody) return { ok: false, error: "Message body is required." };

    const supabase = createServiceRoleClient();
    const { data: contacts, error: cErr } = await supabase
      .from("concrete_order_contacts")
      .select("id, name, phone")
      .order("sort_order");
    if (cErr) return { ok: false, error: cErr.message };

    const chosenIds = recipientIdsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const recipients = (contacts ?? []).filter((c) =>
      chosenIds.length === 0 ? true : chosenIds.includes(c.id),
    );
    if (recipients.length === 0) {
      return { ok: false, error: "No recipients selected." };
    }

    const snapshot = recipients.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("concrete_orders")
      .insert({
        project_id: projectId,
        pour_date: pourDate,
        pour_time: pourTime,
        yards: yards ? Number(yards) : null,
        psi,
        slump,
        mix_notes: mixNotes,
        delivery_address: deliveryAddress,
        site_contact: siteContact,
        site_phone: sitePhone,
        recipients: snapshot,
        message_body: messageBody,
        sent_by: user.id,
        status: sendNow ? "sending" : "draft",
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return { ok: false, error: insErr?.message ?? "Failed to save order." };
    }

    if (!sendNow) {
      revalidatePath("/dashboard/concrete-order");
      return { ok: true, id: inserted.id, sent: 0, failed: 0, skipped: false };
    }

    const adapter = getOpenPhoneAdapter();
    const perRecipient: Record<string, { ok: boolean; error?: string; external_id?: string | null }> = {};
    let sent = 0;
    let failed = 0;
    let anyAdapterSkip = false;
    for (const r of recipients) {
      const phone = normalizePhone(r.phone);
      if (!phone) {
        perRecipient[r.id] = { ok: false, error: "invalid phone" };
        failed++;
        continue;
      }
      const res = await adapter.sendMessage(phone, messageBody);
      if (res.ok) {
        perRecipient[r.id] = { ok: true, external_id: res.external_id };
        sent++;
      } else {
        if (res.skip) anyAdapterSkip = true;
        perRecipient[r.id] = { ok: false, error: res.error };
        failed++;
      }
    }

    await supabase
      .from("concrete_orders")
      .update({
        openphone_refs: perRecipient,
        sent_at: new Date().toISOString(),
        status: sent > 0 ? "sent" : anyAdapterSkip ? "draft" : "failed",
      })
      .eq("id", inserted.id);

    revalidatePath("/dashboard/concrete-order");
    return {
      ok: true,
      id: inserted.id,
      sent,
      failed,
      skipped: anyAdapterSkip && sent === 0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function saveContactAction(
  _prev: ContactResult | null,
  fd: FormData,
): Promise<ContactResult> {
  try {
    await requireRole(["admin"]);
    const id = String(fd.get("id") ?? "") || null;
    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const role = String(fd.get("role") ?? "").trim() || null;
    const isDefault = String(fd.get("is_default") ?? "") === "on";
    if (!name || !phone) {
      return { ok: false, error: "Name and phone required." };
    }
    const supabase = createServiceRoleClient();
    if (id) {
      const { error } = await supabase
        .from("concrete_order_contacts")
        .update({ name, phone, role, is_default: isDefault })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("concrete_order_contacts")
        .insert({ name, phone, role, is_default: isDefault });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/dashboard/concrete-order");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save contact.",
    };
  }
}

export async function deleteContactAction(
  id: string,
): Promise<ContactResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("concrete_order_contacts")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/concrete-order");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete.",
    };
  }
}
