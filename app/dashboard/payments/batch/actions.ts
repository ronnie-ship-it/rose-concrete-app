"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { autoInvoiceForApprovedQuote } from "@/lib/qbo/auto-invoice";

export type BatchResult =
  | {
      ok: true;
      attempted: number;
      succeeded: number;
      skipped: Array<{ project_id: string; reason: string }>;
      failed: Array<{ project_id: string; error: string }>;
    }
  | { ok: false; error: string };

/**
 * Generate QBO invoices for N projects in one click.
 *
 * Reuses the existing `autoInvoiceForApprovedQuote` helper — same
 * side-effects as the quote-accept flow: QBO customer lookup/create,
 * invoice creation, schedule stamped with qbo_invoice_id, activity_log
 * entry. Failures per project are captured and returned — the batch
 * doesn't abort on the first failure.
 *
 * Gate: the `qbo_auto_invoice` feature flag applies here too (mirroring
 * the per-accept behavior). When the flag is off the button on the UI
 * still runs, but each project comes back `skipped=flag_off`.
 */
export async function generateBatchInvoicesAction(
  _prev: BatchResult | null,
  fd: FormData,
): Promise<BatchResult> {
  try {
    await requireUser();
    await requireRole(["admin", "office"]);
    const projectIdsCsv = String(fd.get("project_ids") ?? "");
    const projectIds = projectIdsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (projectIds.length === 0) {
      return {
        ok: false,
        error: "No projects selected.",
      };
    }
    const supabase = createServiceRoleClient();
    let succeeded = 0;
    const skipped: Array<{ project_id: string; reason: string }> = [];
    const failed: Array<{ project_id: string; error: string }> = [];

    for (const projectId of projectIds) {
      // Most-recent quote for the project — the auto-invoice helper
      // wants a quoteId so it can look up locked_payment_method etc.
      const { data: quote } = await supabase
        .from("quotes")
        .select("id")
        .eq("project_id", projectId)
        .order("accepted_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const result = await autoInvoiceForApprovedQuote(
        projectId,
        quote?.id ?? "",
        supabase,
      );
      if (!result.ok) {
        failed.push({ project_id: projectId, error: result.error });
        continue;
      }
      if ("skipped" in result) {
        skipped.push({ project_id: projectId, reason: result.skipped });
        continue;
      }
      succeeded++;
    }

    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/payments/batch");
    return {
      ok: true,
      attempted: projectIds.length,
      succeeded,
      skipped,
      failed,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Batch failed.",
    };
  }
}
