"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQboCsv } from "@/lib/qbo/csv";
import {
  matchExpense,
  type ExpenseRow,
  type MatchCandidate,
} from "@/lib/qbo/matching";

/**
 * Phase 2 — QBO Job Costing: server actions for the admin Settings page.
 *
 * The ingest path today is: admin exports a "Transaction List by Customer"
 * or "Expenses by Vendor Detail" CSV from QuickBooks → uploads it here →
 * this action parses, matches each row to a project, inserts into job_costs,
 * logs the import, and recomputes cached profitability for every touched
 * project. The matching logic is shared with the (future) OAuth sync.
 */

// --------- Upload CSV ---------

export type UploadState =
  | { ok: true; summary: UploadSummary }
  | { ok: false; error: string }
  | null;

type UploadSummary = {
  importId: string;
  totalRows: number;
  inserted: number;
  duplicates: number;
  matched: number;
  unmatched: number;
  warnings: string[];
};

export async function uploadQboCsvAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  const user = await requireRole(["admin", "office"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a CSV file to upload." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "CSV is larger than 5 MB — split it into smaller files." };
  }

  const text = await file.text();
  const parsed = parseQboCsv(text);

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error:
        parsed.warnings[0] ||
        "No expense rows were parsed from that file. Make sure you exported a Transaction List or Expenses Detail report as CSV.",
    };
  }

  const supabase = await createClient();

  // Load match candidates once up front (not per row). Only active projects:
  // done/cancelled projects should not be picking up new expenses.
  const { data: candidateRows, error: candErr } = await supabase
    .from("projects")
    .select(
      "id, client_id, qbo_customer_id, qbo_customer_name, client:clients(name)"
    )
    .not("status", "in", "(done,cancelled)");

  if (candErr) {
    return { ok: false, error: `Loading projects failed: ${candErr.message}` };
  }

  const candidates: MatchCandidate[] = (candidateRows ?? []).map((r) => {
    const client = Array.isArray(r.client) ? r.client[0] : r.client;
    return {
      id: r.id as string,
      client_id: r.client_id as string,
      qbo_customer_id: (r.qbo_customer_id as string | null) ?? null,
      qbo_customer_name: (r.qbo_customer_name as string | null) ?? null,
      clientName: (client?.name as string | undefined) ?? "",
    };
  });

  // Create the import log row first so every inserted job_cost can reference
  // it — that's the hook we need later to undo a bad import.
  const { data: importRow, error: importErr } = await supabase
    .from("qbo_imports")
    .insert({
      uploaded_by: user.id,
      filename: file.name,
      source: "csv",
      row_count: parsed.rows.length,
    })
    .select("id")
    .single();

  if (importErr || !importRow) {
    return {
      ok: false,
      error: `Could not create import log: ${importErr?.message ?? "unknown"}`,
    };
  }
  const importId = importRow.id as string;

  // Classify each parsed row.
  type PreparedRow = ExpenseRow & {
    project_id: string | null;
    match_source: "auto_customer" | "auto_name" | "unmatched";
  };

  const prepared: PreparedRow[] = parsed.rows.map((row) => {
    const result = matchExpense(row, candidates);
    return {
      ...row,
      project_id: result.projectId,
      match_source: result.source,
    };
  });

  // Insert in chunks — upsert on qbo_transaction_id so re-importing the same
  // report is idempotent. `ignoreDuplicates` keeps any manual project
  // reassignment the user already made on a prior import.
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const chunk = prepared.slice(i, i + CHUNK).map((r) => ({
      qbo_transaction_id: r.qboTransactionId,
      project_id: r.project_id,
      match_source: r.match_source,
      raw_customer: r.rawCustomer,
      category: r.category,
      amount: r.amount,
      occurred_on: r.occurredOn,
      memo: r.memo,
      import_id: importId,
    }));

    const { data, error } = await supabase
      .from("job_costs")
      .upsert(chunk, {
        onConflict: "qbo_transaction_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      return {
        ok: false,
        error: `Insert failed at row ${i + 1}: ${error.message}`,
      };
    }
    inserted += data?.length ?? 0;
  }

  const matched = prepared.filter((r) => r.project_id !== null).length;
  const unmatched = prepared.length - matched;
  const duplicates = prepared.length - inserted;

  // Update the import log with the real counts.
  await supabase
    .from("qbo_imports")
    .update({
      row_count: prepared.length,
      matched_count: matched,
      skipped_count: parsed.skipped + duplicates,
      notes:
        parsed.warnings.length > 0 ? parsed.warnings.join(" • ") : null,
    })
    .eq("id", importId);

  // Recompute cached profitability for every project we touched.
  const touched = Array.from(
    new Set(prepared.map((r) => r.project_id).filter((id): id is string => !!id))
  );
  for (const projectId of touched) {
    await supabase.rpc("recompute_project_profitability", {
      p_project_id: projectId,
    });
  }

  revalidatePath("/dashboard/settings/qbo");
  revalidatePath("/dashboard/projects");
  for (const projectId of touched) {
    revalidatePath(`/dashboard/projects/${projectId}`);
  }

  return {
    ok: true,
    summary: {
      importId,
      totalRows: prepared.length,
      inserted,
      duplicates,
      matched,
      unmatched,
      warnings: parsed.warnings,
    },
  };
}

// --------- Assign an unmatched cost to a project ---------

const AssignSchema = z.object({
  cost_id: z.string().uuid(),
  project_id: z.string().uuid(),
});

export async function assignCostToProjectAction(
  formData: FormData
): Promise<void> {
  await requireRole(["admin", "office"]);
  const parsed = AssignSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Invalid assignment.");

  const supabase = await createClient();

  // Need the previous project_id so we can recompute its cache too (if the
  // admin is moving a cost from one project to another rather than assigning
  // a previously-unmatched one).
  const { data: before } = await supabase
    .from("job_costs")
    .select("project_id")
    .eq("id", parsed.data.cost_id)
    .single();

  const { error } = await supabase
    .from("job_costs")
    .update({
      project_id: parsed.data.project_id,
      match_source: "manual",
    })
    .eq("id", parsed.data.cost_id);

  if (error) throw new Error(error.message);

  const toRecompute = new Set<string>();
  toRecompute.add(parsed.data.project_id);
  if (before?.project_id && before.project_id !== parsed.data.project_id) {
    toRecompute.add(before.project_id as string);
  }
  for (const projectId of toRecompute) {
    await supabase.rpc("recompute_project_profitability", {
      p_project_id: projectId,
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
  }

  revalidatePath("/dashboard/settings/qbo");
  revalidatePath("/dashboard/settings/qbo/unmatched");
}

// --------- Delete an import (undo a bad upload) ---------

export async function deleteImportAction(importId: string): Promise<void> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  // Find every project we need to recompute after the delete.
  const { data: affected } = await supabase
    .from("job_costs")
    .select("project_id")
    .eq("import_id", importId);

  const touched = Array.from(
    new Set(
      (affected ?? [])
        .map((r) => r.project_id as string | null)
        .filter((id): id is string => !!id)
    )
  );

  const { error: costErr } = await supabase
    .from("job_costs")
    .delete()
    .eq("import_id", importId);
  if (costErr) throw new Error(costErr.message);

  const { error: importErr } = await supabase
    .from("qbo_imports")
    .delete()
    .eq("id", importId);
  if (importErr) throw new Error(importErr.message);

  for (const projectId of touched) {
    await supabase.rpc("recompute_project_profitability", {
      p_project_id: projectId,
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
  }

  revalidatePath("/dashboard/settings/qbo");
}
