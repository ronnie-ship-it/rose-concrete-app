"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireTenantId } from "@/lib/tenant";

export type WorkspaceResult = { ok: true } | { ok: false; error: string };

/**
 * Rename / reslug the current user's tenant. Admin only (enforced
 * via requireRole + the RLS policy on tenants).
 */
export async function updateWorkspaceAction(
  _prev: WorkspaceResult | null,
  fd: FormData,
): Promise<WorkspaceResult> {
  try {
    await requireRole(["admin"]);
    const tenantId = await requireTenantId();
    const name = String(fd.get("name") ?? "").trim();
    const slug = String(fd.get("slug") ?? "").trim() || null;
    if (!name || name.length < 2) {
      return { ok: false, error: "Workspace name is required." };
    }
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return {
        ok: false,
        error: "Slug may only contain lowercase letters, numbers, and dashes.",
      };
    }
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("tenants")
      .update({ name, slug })
      .eq("id", tenantId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/workspace");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}
