"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type LeadResult = { ok: true } | { ok: false; error: string };

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
];

export async function setLeadStatusAction(
  leadId: string,
  status: LeadStatus,
): Promise<LeadResult> {
  try {
    await requireRole(["admin", "office"]);
    if (!LEAD_STATUSES.includes(status)) {
      return { ok: false, error: "Invalid status." };
    }
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", leadId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/leads");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function convertLeadToClientAction(
  leadId: string,
): Promise<LeadResult | { ok: true; clientId: string }> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();

    const { data: lead } = await supabase
      .from("leads")
      .select(
        "id, status, client_id, contact_name, contact_phone, contact_email, service_address, service_type, message, source",
      )
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return { ok: false, error: "Lead not found." };

    let clientId = (lead.client_id as string | null) ?? null;
    if (!clientId) {
      const name =
        (lead.contact_name as string | null) ??
        (lead.contact_email as string | null) ??
        (lead.contact_phone as string | null) ??
        "New customer";
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({
          name,
          phone: lead.contact_phone ?? null,
          email: lead.contact_email ?? null,
          address: lead.service_address ?? null,
          source: (lead.source as string | null) ?? "lead",
        })
        .select("id")
        .single();
      if (cErr || !client) {
        return { ok: false, error: cErr?.message ?? "Client insert failed." };
      }
      clientId = client.id;
    }

    await supabase
      .from("leads")
      .update({ status: "converted", client_id: clientId })
      .eq("id", leadId);

    revalidatePath("/dashboard/leads");
    revalidatePath("/dashboard/clients");
    if (!clientId) {
      return { ok: false, error: "Client id missing after insert." };
    }
    return { ok: true, clientId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
