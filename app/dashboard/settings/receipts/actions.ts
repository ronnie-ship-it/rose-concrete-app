"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Admin form that edits the three receipt-template columns on
 * invoice_settings (see migration 010) + toggles the qbo_receipt_auto_send
 * feature flag without the admin having to touch the flags table.
 */

export type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateReceiptSettings(
  formData: FormData
): Promise<UpdateResult> {
  await requireRole(["admin"]);

  const sender = String(formData.get("receipt_sender_email") ?? "").trim();
  const subject = String(formData.get("receipt_subject_template") ?? "").trim();
  const body = String(formData.get("receipt_body_template") ?? "").trim();
  const enabled = formData.get("qbo_receipt_auto_send") === "on";

  if (!sender || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sender)) {
    return { ok: false, error: "Sender email looks invalid." };
  }
  if (!subject) return { ok: false, error: "Subject template cannot be empty." };
  if (!body) return { ok: false, error: "Body template cannot be empty." };

  const supabase = await createClient();

  const { error: updateErr } = await supabase
    .from("invoice_settings")
    .update({
      receipt_sender_email: sender,
      receipt_subject_template: subject,
      receipt_body_template: body,
    })
    .eq("singleton", true);

  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: flagErr } = await supabase
    .from("feature_flags")
    .update({ enabled })
    .eq("key", "qbo_receipt_auto_send");
  if (flagErr) return { ok: false, error: flagErr.message };

  revalidatePath("/dashboard/settings/receipts");
  return { ok: true };
}
