"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type TemplateResult = { ok: true } | { ok: false; error: string };

export async function updateTemplateAction(
  slug: string,
  _prev: TemplateResult | null,
  fd: FormData,
): Promise<TemplateResult> {
  try {
    await requireRole(["admin"]);
    if (!slug) return { ok: false, error: "Missing slug." };
    const email_subject =
      String(fd.get("email_subject") ?? "").trim() || null;
    const email_body = String(fd.get("email_body") ?? "").trim() || null;
    const sms_body = String(fd.get("sms_body") ?? "").trim() || null;
    const send_email = String(fd.get("send_email") ?? "") === "on";
    const send_sms = String(fd.get("send_sms") ?? "") === "on";
    const is_active = String(fd.get("is_active") ?? "") === "on";

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("message_templates")
      .update({
        email_subject,
        email_body,
        sms_body,
        send_email,
        send_sms,
        is_active,
      })
      .eq("slug", slug);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/templates");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save.",
    };
  }
}
