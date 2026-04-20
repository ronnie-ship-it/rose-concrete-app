"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type RequestResult = { ok: true } | { ok: false; error: string };

const ALLOWED = ["new", "contacted", "qualified", "converted", "lost"] as const;
type LeadStatus = (typeof ALLOWED)[number];

export async function updateRequestStatusAction(
  leadId: string,
  status: LeadStatus,
): Promise<RequestResult> {
  try {
    await requireRole(["admin", "office"]);
    if (!(ALLOWED as readonly string[]).includes(status)) {
      return { ok: false, error: "Invalid status." };
    }
    const supabase = createServiceRoleClient();
    const patch: Record<string, unknown> = { status };
    if (status === "contacted") patch.responded_at = new Date().toISOString();
    if (status === "converted") patch.converted_at = new Date().toISOString();
    const { error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", leadId);
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_log").insert({
      entity_type: "lead",
      entity_id: leadId,
      action: `request_${status}`,
      payload: { status },
    });

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pipeline");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update.",
    };
  }
}

export async function assignRequestAction(
  leadId: string,
  assignee_id: string | null,
): Promise<RequestResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    // Reflect on the seeded follow-up task so the kanban card follows along.
    await supabase
      .from("tasks")
      .update({ assignee_id })
      .eq("source_id", leadId)
      .like("source", "lead:%");
    revalidatePath("/dashboard/requests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed.",
    };
  }
}
