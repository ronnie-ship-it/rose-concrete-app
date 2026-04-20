"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { parseCsv, pick } from "@/lib/csv";
import {
  mapClientRow,
  mapProjectRow,
  mapQuoteRow,
  mapVisitRow,
  mapLineItemRow,
  mapContactRow,
  mapClientCommunicationRow,
  mapRequestRow,
  mapFeedbackRow,
  previewFile,
  type ImportKind,
} from "@/lib/jobber-import";
import {
  buildNameIndex,
  buildLatestProjectByClientIndex,
} from "@/lib/fuzzy-match";
import { emptyBreakdown, type ImportResult, type PreviewResult } from "./types";

/**
 * Jobber CSV imports — third pass, rebuilt to actually write to the DB.
 *
 * Previous revision inserted row-by-row with `.select("id").single()`. That
 * pattern is fragile: any schema drift or RLS edge makes the select return
 * zero rows, `.single()` throws, and the action records a skip — so the user
 * sees "Inserted 0" even when the insert itself succeeded. This pass:
 *
 *   * Batches inserts (200 rows at a time) and returns the inserted ids.
 *   * Uses `.select("id")` without `.single()` so row-count edges don't mask
 *     real errors.
 *   * Wraps the whole action in try/catch so env/connection failures surface
 *     as `{ok: false, error}` instead of an unhandled promise.
 *   * Writes a `[import:<kind>]` summary line on every run — Ronnie and I
 *     can tail the server log to see what actually happened.
 *   * Keeps the "skip on existing" semantics from the prior spec: clients by
 *     name, projects by external_id (or client+name), quotes by number,
 *     visits by (project, scheduled_for), line items by title.
 *
 * Types + helpers live in ./types so this file only exports async
 * functions — Next.js "use server" files are strict about that.
 */

// Re-export types for backward compatibility with existing import sites.
export type { ImportResult, PreviewResult, SkipBreakdown } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;
const BATCH_SIZE = 200;
const MAX_REASONS = 25;

async function readFile(fd: FormData): Promise<string | { error: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file provided." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File too large (max 10 MB)." };
  }
  return await file.text();
}

function addReason(reasons: string[], msg: string): void {
  if (reasons.length < MAX_REASONS) reasons.push(msg);
}

function summary(
  kind: string,
  inserted: number,
  skipped: number,
  reasons: string[]
): void {
  console.log(
    `[import:${kind}] done — inserted=${inserted} skipped=${skipped}` +
      (reasons.length > 0 ? ` firstReason="${reasons[0]}"` : "")
  );
}

// ---------- preview ----------

export async function previewImportAction(
  kind: ImportKind,
  _prev: PreviewResult | null,
  fd: FormData
): Promise<PreviewResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };
    const p = previewFile(kind, text);
    return { ok: true, ...p };
  } catch (err) {
    console.error(`[import:${kind}] preview failed`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to preview CSV.",
    };
  }
}

// ---------- commit: clients ----------

export async function importClientsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];

    const { data: existing, error: existingErr } = await supabase
      .from("clients")
      .select("id, name");
    if (existingErr) {
      console.error("[import:clients] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read existing clients: ${existingErr.message}`,
      };
    }
    const byName = new Map(
      (existing ?? []).map((c) => [c.name.toLowerCase().trim(), c.id])
    );

    type Payload = {
      rowNumber: number;
      nameKey: string;
      payload: Record<string, unknown>;
    };
    const toInsert: Payload[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 for header, +1 for 1-indexed
      const mapped = mapClientRow(rows[i]);
      if (!mapped) {
        skipped++;
        addReason(reasons, `Row ${rowNumber}: missing client name`);
        continue;
      }
      const nameKey = mapped.name.toLowerCase().trim();
      if (byName.has(nameKey)) {
        skipped++;
        continue;
      }
      // Prevent duplicate rows inside the same CSV.
      if (toInsert.some((x) => x.nameKey === nameKey)) {
        skipped++;
        continue;
      }
      toInsert.push({
        rowNumber,
        nameKey,
        payload: {
          name: mapped.name,
          phone: mapped.phone,
          email: mapped.email,
          address: mapped.address,
          lead_source: mapped.lead_source,
          tags: mapped.tags,
          source: mapped.lead_source ?? "jobber_import",
          ...(mapped.created_at ? { created_at: mapped.created_at } : {}),
        },
      });
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("clients")
        .insert(batch.map((b) => b.payload))
        .select("id, name");
      if (error) {
        console.error(
          `[import:clients] batch ${i / BATCH_SIZE} failed`,
          error,
          "first row:",
          batch[0]?.payload
        );
        // Fall back to row-by-row so a single bad row doesn't sink the batch.
        for (const row of batch) {
          const { data: one, error: oneErr } = await supabase
            .from("clients")
            .insert(row.payload)
            .select("id");
          if (oneErr || !one || one.length === 0) {
            skipped++;
            addReason(
              reasons,
              `Row ${row.rowNumber}: ${oneErr?.message ?? "insert returned no row"}`
            );
            continue;
          }
          byName.set(row.nameKey, one[0].id);
          inserted++;
        }
        continue;
      }
      if (!data || data.length === 0) {
        console.error(
          "[import:clients] batch insert returned no rows — possible RLS misconfig"
        );
        skipped += batch.length;
        addReason(
          reasons,
          `Batch at row ${batch[0].rowNumber}: insert returned no rows`
        );
        continue;
      }
      for (const row of data) {
        byName.set(row.name.toLowerCase().trim(), row.id);
      }
      inserted += data.length;
    }

    summary("clients", inserted, skipped, reasons);
    revalidatePath("/dashboard/clients");
    return { ok: true, inserted, skipped, reasons };
  } catch (err) {
    console.error("[import:clients] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: projects ----------

export async function importProjectsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];
    const breakdown = emptyBreakdown();

    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name");
    if (clientsErr) {
      console.error("[import:projects] read clients failed", clientsErr);
      return {
        ok: false,
        error: `Failed to read clients: ${clientsErr.message}`,
      };
    }
    const clientIdx = buildNameIndex(clients ?? []);

    const { data: existing, error: existingErr } = await supabase
      .from("projects")
      .select("id, name, client_id, external_id");
    if (existingErr) {
      console.error("[import:projects] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read projects: ${existingErr.message}`,
      };
    }
    const byExternalId = new Map(
      (existing ?? [])
        .filter((p) => p.external_id)
        .map((p) => [p.external_id as string, p.id])
    );
    const byClientName = new Map<string, string>();
    for (const p of existing ?? []) {
      byClientName.set(
        `${p.client_id}::${p.name.toLowerCase().trim()}`,
        p.id
      );
    }

    type Payload = {
      rowNumber: number;
      externalId: string | null;
      pairKey: string;
      payload: Record<string, unknown>;
    };
    const toInsert: Payload[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapProjectRow(rows[i]);
      if (!mapped) {
        skipped++;
        breakdown.mapper_invalid++;
        addReason(reasons, `Row ${rowNumber}: missing client name`);
        continue;
      }
      const clientId = clientIdx.resolve(mapped.client_name);
      if (!clientId) {
        skipped++;
        breakdown.parent_missing++;
        addReason(
          reasons,
          `Row ${rowNumber}: client "${mapped.client_name}" not found`
        );
        // Stage for manual review with top-3 suggestions.
        const suggestions = clientIdx.suggest(mapped.client_name, 3);
        await stageReviewRow(supabase, {
          kind: "project",
          rowNumber,
          raw: rows[i],
          payload: mapped as unknown as Record<string, unknown>,
          reason: `Client "${mapped.client_name}" not found`,
          suggestions,
        });
        continue;
      }
      if (mapped.external_id && byExternalId.has(mapped.external_id)) {
        skipped++;
        breakdown.already_imported++;
        addReason(
          reasons,
          `Row ${rowNumber}: job # ${mapped.external_id} already imported`
        );
        continue;
      }
      const pairKey = `${clientId}::${mapped.name.toLowerCase().trim()}`;
      if (!mapped.external_id && byClientName.has(pairKey)) {
        skipped++;
        breakdown.already_imported++;
        addReason(
          reasons,
          `Row ${rowNumber}: "${mapped.name}" for ${mapped.client_name} already exists`
        );
        continue;
      }
      if (
        mapped.external_id &&
        toInsert.some((x) => x.externalId === mapped.external_id)
      ) {
        skipped++;
        breakdown.duplicate_in_file++;
        addReason(
          reasons,
          `Row ${rowNumber}: duplicate job # ${mapped.external_id} in file`
        );
        continue;
      }
      if (!mapped.external_id && toInsert.some((x) => x.pairKey === pairKey)) {
        skipped++;
        breakdown.duplicate_in_file++;
        addReason(
          reasons,
          `Row ${rowNumber}: duplicate (client,name) in file`
        );
        continue;
      }

      const status = mapped.completed_at ? "done" : "lead";
      toInsert.push({
        rowNumber,
        externalId: mapped.external_id,
        pairKey,
        payload: {
          client_id: clientId,
          name: mapped.name,
          external_id: mapped.external_id,
          scheduled_start: mapped.scheduled_start,
          completed_at: mapped.completed_at,
          revenue_cached: mapped.revenue_cached,
          service_address: mapped.service_address,
          location: mapped.service_address,
          status,
          ...(mapped.created_at ? { created_at: mapped.created_at } : {}),
        },
      });
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("projects")
        .insert(batch.map((b) => b.payload))
        .select("id, external_id");
      if (error) {
        console.error(
          `[import:projects] batch ${i / BATCH_SIZE} failed`,
          error,
          "first row:",
          batch[0]?.payload
        );
        for (const row of batch) {
          const { data: one, error: oneErr } = await supabase
            .from("projects")
            .insert(row.payload)
            .select("id");
          if (oneErr || !one || one.length === 0) {
            skipped++;
            breakdown.db_error++;
            addReason(
              reasons,
              `Row ${row.rowNumber}: ${oneErr?.message ?? "insert returned no row"}`
            );
            continue;
          }
          if (row.externalId) byExternalId.set(row.externalId, one[0].id);
          byClientName.set(row.pairKey, one[0].id);
          inserted++;
        }
        continue;
      }
      if (!data || data.length === 0) {
        console.error(
          "[import:projects] batch insert returned no rows — possible RLS misconfig"
        );
        skipped += batch.length;
        breakdown.db_error += batch.length;
        addReason(
          reasons,
          `Batch at row ${batch[0].rowNumber}: insert returned no rows`
        );
        continue;
      }
      inserted += data.length;
      // Re-index so later dedupe in this same run works.
      for (let j = 0; j < data.length; j++) {
        const meta = batch[j];
        if (meta?.externalId)
          byExternalId.set(meta.externalId, data[j].id as string);
        if (meta?.pairKey)
          byClientName.set(meta.pairKey, data[j].id as string);
      }
    }

    summary("projects", inserted, skipped, reasons);
    revalidatePath("/dashboard/projects");
    return { ok: true, inserted, skipped, reasons, breakdown };
  } catch (err) {
    console.error("[import:projects] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: quotes ----------

export async function importQuotesAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];
    const breakdown = emptyBreakdown();

    const { data: clientsAll, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name");
    if (clientsErr) {
      return {
        ok: false,
        error: `Failed to read clients: ${clientsErr.message}`,
      };
    }

    const { data: projects, error: projectsErr } = await supabase
      .from("projects")
      .select("id, client_id, created_at")
      .order("created_at", { ascending: false });
    if (projectsErr) {
      console.error("[import:quotes] read projects failed", projectsErr);
      return {
        ok: false,
        error: `Failed to read projects: ${projectsErr.message}`,
      };
    }

    const resolveProjectByClientName = buildLatestProjectByClientIndex(
      clientsAll ?? [],
      projects ?? []
    );
    // Separate client-only resolver so we can still auto-create a
    // placeholder project when the quote's parent project is missing.
    const clientIdx = buildNameIndex(clientsAll ?? []);

    const { data: existingQuotes, error: existingErr } = await supabase
      .from("quotes")
      .select("number");
    if (existingErr) {
      console.error("[import:quotes] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read quotes: ${existingErr.message}`,
      };
    }
    const existingNumbers = new Set(
      (existingQuotes ?? []).map((q) => q.number)
    );

    type Payload = {
      rowNumber: number;
      number: string;
      payload: Record<string, unknown>;
    };
    const toInsert: Payload[] = [];

    // Cache placeholder projects created during this run so a CSV with
    // N quotes for the same fresh client only creates one placeholder.
    // Keyed on clientId.
    const placeholderProjectByClient = new Map<string, string>();
    let placeholdersCreated = 0;

    async function ensureProjectForQuote(args: {
      clientId: string;
      quoteTitle: string | null;
      quoteNumber: string;
      createdAt: string | null;
    }): Promise<string | null> {
      const cached = placeholderProjectByClient.get(args.clientId);
      if (cached) return cached;
      const projName =
        args.quoteTitle?.trim() ||
        `Imported quote ${args.quoteNumber} (no linked job)`;
      const insertPayload: Record<string, unknown> = {
        client_id: args.clientId,
        name: projName.slice(0, 180),
        status: "lead",
      };
      if (args.createdAt) insertPayload.created_at = args.createdAt;
      const { data, error } = await supabase
        .from("projects")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error || !data) {
        console.error(
          "[import:quotes] placeholder project insert failed",
          error,
        );
        return null;
      }
      placeholderProjectByClient.set(args.clientId, data.id);
      placeholdersCreated++;
      return data.id;
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapQuoteRow(rows[i]);
      if (!mapped) {
        skipped++;
        breakdown.mapper_invalid++;
        addReason(reasons, `Row ${rowNumber}: missing quote # or client`);
        continue;
      }
      if (existingNumbers.has(mapped.number)) {
        skipped++;
        breakdown.already_imported++;
        addReason(
          reasons,
          `Row ${rowNumber}: quote ${mapped.number} already imported`
        );
        continue;
      }
      if (toInsert.some((x) => x.number === mapped.number)) {
        skipped++;
        breakdown.duplicate_in_file++;
        addReason(
          reasons,
          `Row ${rowNumber}: duplicate quote ${mapped.number} in file`
        );
        continue;
      }

      // Try the happy path first: an existing project for this client.
      let projectId = resolveProjectByClientName(mapped.client_name);

      // No matching project — try to resolve just the client and spin up
      // a placeholder project so the quote still lands (Jobber parity:
      // a quote is meaningless without a home to point at, but Thomas's
      // historical data has 100s of legacy quotes without matching jobs).
      if (!projectId) {
        const clientId = clientIdx.resolve(mapped.client_name);
        if (clientId) {
          projectId = await ensureProjectForQuote({
            clientId,
            quoteTitle: mapped.title,
            quoteNumber: mapped.number,
            createdAt: mapped.created_at,
          });
        }
      }

      // Still null — both project AND client couldn't be resolved.
      // Stage for manual review with the top-3 fuzzy client suggestions
      // so Ronnie can pick or dismiss from /dashboard/settings/import-review.
      if (!projectId) {
        skipped++;
        breakdown.parent_missing++;
        addReason(
          reasons,
          `Row ${rowNumber}: no client match for "${mapped.client_name}" — staged for review`
        );
        const suggestions = clientIdx.suggest(mapped.client_name, 3);
        await stageReviewRow(supabase, {
          kind: "quote",
          rowNumber,
          raw: rows[i],
          payload: mapped as unknown as Record<string, unknown>,
          reason: `No client match for "${mapped.client_name}"`,
          suggestions,
        });
        continue;
      }

      const acceptedTotal = mapped.status === "accepted" ? mapped.total : null;
      toInsert.push({
        rowNumber,
        number: mapped.number,
        payload: {
          project_id: projectId,
          number: mapped.number,
          title: mapped.title,
          status: mapped.status,
          base_total: mapped.total,
          accepted_total: acceptedTotal,
          accepted_at:
            mapped.status === "accepted" ? mapped.approved_at : null,
          approved_at: mapped.approved_at,
          deposit_amount: mapped.deposit_amount,
          ...(mapped.created_at ? { created_at: mapped.created_at } : {}),
        },
      });
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("quotes")
        .insert(batch.map((b) => b.payload))
        .select("id, number");
      if (error) {
        console.error(
          `[import:quotes] batch ${i / BATCH_SIZE} failed`,
          error,
          "first row:",
          batch[0]?.payload
        );
        for (const row of batch) {
          const { data: one, error: oneErr } = await supabase
            .from("quotes")
            .insert(row.payload)
            .select("id");
          if (oneErr || !one || one.length === 0) {
            skipped++;
            breakdown.db_error++;
            addReason(
              reasons,
              `Row ${row.rowNumber}: ${oneErr?.message ?? "insert returned no row"}`
            );
            continue;
          }
          existingNumbers.add(row.number);
          inserted++;
        }
        continue;
      }
      if (!data || data.length === 0) {
        console.error(
          "[import:quotes] batch insert returned no rows — possible RLS misconfig"
        );
        skipped += batch.length;
        breakdown.db_error += batch.length;
        addReason(
          reasons,
          `Batch at row ${batch[0].rowNumber}: insert returned no rows`
        );
        continue;
      }
      for (const row of data) existingNumbers.add(row.number as string);
      inserted += data.length;
    }

    summary("quotes", inserted, skipped, reasons);
    if (placeholdersCreated > 0) {
      console.log(
        `[import:quotes] created ${placeholdersCreated} placeholder project(s) for orphaned quotes`,
      );
      addReason(
        reasons,
        `Auto-created ${placeholdersCreated} placeholder project${
          placeholdersCreated === 1 ? "" : "s"
        } for orphaned quotes. Review under /dashboard/projects?status=lead.`,
      );
    }
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/projects");
    return { ok: true, inserted, skipped, reasons, breakdown };
  } catch (err) {
    console.error("[import:quotes] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: visits ----------

export async function importVisitsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];
    const breakdown = emptyBreakdown();

    const { data: projects, error: projectsErr } = await supabase
      .from("projects")
      .select("id, external_id, client_id, created_at")
      .order("created_at", { ascending: false });
    if (projectsErr) {
      console.error("[import:visits] read projects failed", projectsErr);
      return {
        ok: false,
        error: `Failed to read projects: ${projectsErr.message}`,
      };
    }
    const projectByExternal = new Map(
      (projects ?? [])
        .filter((p) => p.external_id)
        .map((p) => [p.external_id as string, p.id])
    );

    const { data: clientsAll } = await supabase
      .from("clients")
      .select("id, name");
    const resolveProjectByClientName = buildLatestProjectByClientIndex(
      clientsAll ?? [],
      projects ?? []
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .not("full_name", "is", null);
    const profileByName = new Map(
      (profiles ?? []).map((p) => [p.full_name!.toLowerCase().trim(), p.id])
    );

    const { data: existingVisits, error: existingVisitsErr } = await supabase
      .from("visits")
      .select("project_id, scheduled_for");
    if (existingVisitsErr) {
      console.error(
        "[import:visits] read existing failed",
        existingVisitsErr
      );
      return {
        ok: false,
        error: `Failed to read visits: ${existingVisitsErr.message}`,
      };
    }
    const existingKey = new Set(
      (existingVisits ?? []).map((v) => `${v.project_id}::${v.scheduled_for}`)
    );

    // Visits have assignee-lookup side-effects so we stay row-by-row here —
    // still wrapped with try/catch + clear logging.
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapVisitRow(rows[i]);
      if (!mapped) {
        skipped++;
        breakdown.mapper_invalid++;
        addReason(reasons, `Row ${rowNumber}: missing Job # and client name`);
        continue;
      }
      let projectId: string | null = null;
      if (mapped.external_job_id) {
        projectId = projectByExternal.get(mapped.external_job_id) ?? null;
      }
      if (!projectId && mapped.client_name) {
        projectId = resolveProjectByClientName(mapped.client_name);
      }
      if (!projectId) {
        skipped++;
        breakdown.parent_missing++;
        addReason(
          reasons,
          `Row ${rowNumber}: no matching project (Job # ${mapped.external_job_id ?? "?"}, client "${mapped.client_name ?? "?"}")`
        );
        continue;
      }

      const scheduledIso =
        mapped.scheduled_date && mapped.scheduled_time
          ? new Date(
              `${mapped.scheduled_date}T${mapped.scheduled_time}`
            ).toISOString()
          : mapped.scheduled_date
          ? new Date(`${mapped.scheduled_date}T08:00:00`).toISOString()
          : null;
      if (!scheduledIso) {
        skipped++;
        breakdown.mapper_invalid++;
        addReason(reasons, `Row ${rowNumber}: missing date`);
        continue;
      }
      const key = `${projectId}::${scheduledIso}`;
      if (existingKey.has(key)) {
        skipped++;
        breakdown.already_imported++;
        addReason(
          reasons,
          `Row ${rowNumber}: visit on ${mapped.scheduled_date} for Job # ${mapped.external_job_id} already imported`
        );
        continue;
      }

      const status = mapped.completed_at ? "completed" : "scheduled";
      const { data: visit, error } = await supabase
        .from("visits")
        .insert({
          project_id: projectId,
          scheduled_for: scheduledIso,
          scheduled_date: mapped.scheduled_date,
          scheduled_time: mapped.scheduled_time,
          status,
          completed_at: mapped.completed_at,
        })
        .select("id");
      if (error || !visit || visit.length === 0) {
        skipped++;
        breakdown.db_error++;
        addReason(
          reasons,
          `Row ${rowNumber}: ${error?.message ?? "insert returned no row"}`
        );
        if (error) console.error(`[import:visits] row ${rowNumber}`, error);
        continue;
      }

      if (mapped.assignee_name) {
        const profileId = profileByName.get(
          mapped.assignee_name.toLowerCase().trim()
        );
        if (profileId) {
          await supabase
            .from("visit_assignments")
            .insert({ visit_id: visit[0].id, user_id: profileId });
        }
      }
      existingKey.add(key);
      inserted++;
    }

    summary("visits", inserted, skipped, reasons);
    revalidatePath("/dashboard/schedule");
    return { ok: true, inserted, skipped, reasons, breakdown };
  } catch (err) {
    console.error("[import:visits] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: line items ----------

export async function importLineItemsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];

    const { data: existing, error: existingErr } = await supabase
      .from("line_item_templates")
      .select("title");
    if (existingErr) {
      console.error("[import:line-items] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read line item templates: ${existingErr.message}`,
      };
    }
    const existingTitles = new Set(
      (existing ?? []).map((r) => r.title.toLowerCase().trim())
    );

    type Payload = {
      rowNumber: number;
      titleKey: string;
      payload: Record<string, unknown>;
    };
    const toInsert: Payload[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapLineItemRow(rows[i]);
      if (!mapped) {
        skipped++;
        addReason(reasons, `Row ${rowNumber}: missing product/service name`);
        continue;
      }
      const titleKey = mapped.title.toLowerCase().trim();
      if (existingTitles.has(titleKey)) {
        skipped++;
        continue;
      }
      if (toInsert.some((x) => x.titleKey === titleKey)) {
        skipped++;
        continue;
      }
      toInsert.push({
        rowNumber,
        titleKey,
        payload: {
          title: mapped.title,
          unit: "job",
          unit_price: mapped.unit_price,
          default_quantity: 1,
          is_active: true,
        },
      });
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("line_item_templates")
        .insert(batch.map((b) => b.payload))
        .select("id, title");
      if (error) {
        console.error(
          `[import:line-items] batch ${i / BATCH_SIZE} failed`,
          error,
          "first row:",
          batch[0]?.payload
        );
        for (const row of batch) {
          const { data: one, error: oneErr } = await supabase
            .from("line_item_templates")
            .insert(row.payload)
            .select("id");
          if (oneErr || !one || one.length === 0) {
            skipped++;
            addReason(
              reasons,
              `Row ${row.rowNumber}: ${oneErr?.message ?? "insert returned no row"}`
            );
            continue;
          }
          existingTitles.add(row.titleKey);
          inserted++;
        }
        continue;
      }
      if (!data || data.length === 0) {
        console.error(
          "[import:line-items] batch insert returned no rows — possible RLS misconfig"
        );
        skipped += batch.length;
        addReason(
          reasons,
          `Batch at row ${batch[0].rowNumber}: insert returned no rows`
        );
        continue;
      }
      for (const row of data)
        existingTitles.add((row.title as string).toLowerCase().trim());
      inserted += data.length;
    }

    summary("line-items", inserted, skipped, reasons);
    revalidatePath("/dashboard/settings/line-items");
    return { ok: true, inserted, skipped, reasons };
  } catch (err) {
    console.error("[import:line-items] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: client contacts ----------

export async function importContactsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];

    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name");
    if (clientsErr) {
      console.error("[import:contacts] read clients failed", clientsErr);
      return {
        ok: false,
        error: `Failed to read clients: ${clientsErr.message}`,
      };
    }
    const clientIdx = buildNameIndex(clients ?? []);

    // Dedupe by (client_id, lowercased email or phone). A client can have
    // multiple contacts, just not duplicates of the same person.
    const { data: existing, error: existingErr } = await supabase
      .from("client_contacts")
      .select("client_id, email, phone");
    if (existingErr) {
      console.error("[import:contacts] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read client_contacts: ${existingErr.message}`,
      };
    }
    const existingKey = new Set<string>();
    for (const c of existing ?? []) {
      if (c.email)
        existingKey.add(
          `${c.client_id}::email::${c.email.toLowerCase().trim()}`
        );
      if (c.phone)
        existingKey.add(
          `${c.client_id}::phone::${c.phone.replace(/[^0-9]/g, "")}`
        );
    }

    type Payload = {
      rowNumber: number;
      key: string;
      payload: Record<string, unknown>;
    };
    const toInsert: Payload[] = [];

    // Auto-create the parent client when a Jobber "Client Contact Info"
    // export is uploaded here — the CSV doubles as a master client list
    // (Contact/Company/Phone/Email/Billing address), and matching on a
    // pre-existing client would fail on a fresh install. Cache by name
    // so 3 rows for the same business produce one client.
    const nameCache = new Map<string, string>();
    let clientsAutoCreated = 0;

    async function ensureClient(
      rawName: string,
      raw: Record<string, string>,
    ): Promise<string | null> {
      const norm = rawName.toLowerCase().trim();
      const cached = nameCache.get(norm);
      if (cached) return cached;
      const resolved = clientIdx.resolve(rawName);
      if (resolved) {
        nameCache.set(norm, resolved);
        return resolved;
      }
      const billingAddress = pick(raw, [
        "billing_address",
        "billing_street",
        "address",
        "street_address",
        "mailing_address",
      ]);
      const leadFlag = (
        pick(raw, ["lead", "is_lead"]) ?? ""
      ).toLowerCase();
      const tags: string[] = [];
      if (
        leadFlag === "true" ||
        leadFlag === "yes" ||
        leadFlag === "1"
      ) {
        tags.push("Lead");
      }
      const createdAtRaw = pick(raw, [
        "created_date",
        "created_at",
        "created",
        "date_created",
        "created_on",
      ]);
      const createdAt = (() => {
        if (!createdAtRaw) return null;
        const d = new Date(createdAtRaw.trim());
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      })();
      const leadSource = pick(raw, [
        "lead_source",
        "source",
        "referral_source",
      ]);
      const insert: Record<string, unknown> = {
        name: rawName,
        phone: pick(raw, [
          "phone",
          "phone_number",
          "primary_phone",
          "main_phone",
          "mobile",
          "mobile_phone",
          "cell",
          "cell_phone",
          "home_phone",
          "work_phone",
          "contact_phone",
          "telephone",
        ]),
        email:
          pick(raw, [
            "email",
            "email_address",
            "primary_email",
            "main_email",
            "contact_email",
            "e_mail",
          ])
            ?.toLowerCase()
            ?.trim() ?? null,
        address: billingAddress,
        lead_source: leadSource,
        tags: tags.length > 0 ? tags : null,
        source: leadSource ?? "jobber_import_contacts",
      };
      if (createdAt) insert.created_at = createdAt;
      const { data, error } = await supabase
        .from("clients")
        .insert(insert)
        .select("id")
        .single();
      if (error || !data) {
        console.error(
          "[import:contacts] auto-create client failed",
          error,
          rawName,
        );
        return null;
      }
      clientsAutoCreated++;
      nameCache.set(norm, data.id);
      return data.id;
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapContactRow(rows[i]);
      if (!mapped) {
        skipped++;
        addReason(
          reasons,
          `Row ${rowNumber}: missing client name + any contact detail`
        );
        continue;
      }
      const clientId = await ensureClient(mapped.client_name, rows[i]);
      if (!clientId) {
        skipped++;
        addReason(
          reasons,
          `Row ${rowNumber}: couldn't resolve or create client "${mapped.client_name}"`
        );
        continue;
      }
      const dedupeKey = mapped.email
        ? `${clientId}::email::${mapped.email.toLowerCase().trim()}`
        : mapped.phone
        ? `${clientId}::phone::${mapped.phone.replace(/[^0-9]/g, "")}`
        : `${clientId}::name::${(mapped.first_name ?? "")}::${(mapped.last_name ?? "")}`;
      if (existingKey.has(dedupeKey)) {
        skipped++;
        continue;
      }
      if (toInsert.some((x) => x.key === dedupeKey)) {
        skipped++;
        continue;
      }
      toInsert.push({
        rowNumber,
        key: dedupeKey,
        payload: {
          client_id: clientId,
          contact_type: mapped.contact_type,
          first_name: mapped.first_name,
          last_name: mapped.last_name,
          email: mapped.email,
          phone: mapped.phone,
          is_primary: mapped.is_primary,
          notes: mapped.notes,
        },
      });
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("client_contacts")
        .insert(batch.map((b) => b.payload))
        .select("id");
      if (error) {
        console.error(
          `[import:contacts] batch ${i / BATCH_SIZE} failed`,
          error,
          "first row:",
          batch[0]?.payload
        );
        for (const row of batch) {
          const { data: one, error: oneErr } = await supabase
            .from("client_contacts")
            .insert(row.payload)
            .select("id");
          if (oneErr || !one || one.length === 0) {
            skipped++;
            addReason(
              reasons,
              `Row ${row.rowNumber}: ${oneErr?.message ?? "insert returned no row"}`
            );
            continue;
          }
          existingKey.add(row.key);
          inserted++;
        }
        continue;
      }
      if (!data || data.length === 0) {
        skipped += batch.length;
        addReason(
          reasons,
          `Batch at row ${batch[0].rowNumber}: insert returned no rows`
        );
        continue;
      }
      for (const b of batch) existingKey.add(b.key);
      inserted += data.length;
    }

    summary("contacts", inserted, skipped, reasons);
    if (clientsAutoCreated > 0) {
      console.log(
        `[import:contacts] auto-created ${clientsAutoCreated} client(s) from the Client Contact Info CSV`,
      );
      addReason(
        reasons,
        `Auto-created ${clientsAutoCreated} client${
          clientsAutoCreated === 1 ? "" : "s"
        } from the Jobber Client Contact Info CSV.`,
      );
    }
    revalidatePath("/dashboard/clients");
    return { ok: true, inserted, skipped, reasons };
  } catch (err) {
    console.error("[import:contacts] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: client communications (email history) ----------

export async function importClientCommunicationsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];

    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name");
    if (clientsErr) {
      console.error(
        "[import:communications] read clients failed",
        clientsErr
      );
      return {
        ok: false,
        error: `Failed to read clients: ${clientsErr.message}`,
      };
    }
    const clientIdx = buildNameIndex(clients ?? []);

    // Dedupe on external_id when present, else (client_id, subject, started_at).
    const { data: existing, error: existingErr } = await supabase
      .from("communications")
      .select("external_id, client_id, subject, started_at")
      .eq("channel", "email");
    if (existingErr) {
      console.error(
        "[import:communications] read existing failed",
        existingErr
      );
      return {
        ok: false,
        error: `Failed to read communications: ${existingErr.message}`,
      };
    }
    const existingExternal = new Set(
      (existing ?? [])
        .map((e) => e.external_id)
        .filter((v): v is string => Boolean(v))
    );
    const existingComposite = new Set(
      (existing ?? []).map(
        (e) =>
          `${e.client_id}::${(e.subject ?? "").toLowerCase()}::${e.started_at}`
      )
    );

    // Cache auto-created clients so a CSV with 40 emails for the same
    // unknown client only creates one client stub.
    const commNameCache = new Map<string, string>();
    let commClientsAutoCreated = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapClientCommunicationRow(rows[i]);
      if (!mapped) {
        skipped++;
        addReason(
          reasons,
          `Row ${rowNumber}: missing client name + subject/body`
        );
        continue;
      }
      const cacheKey = mapped.client_name.toLowerCase().trim();
      let clientId =
        commNameCache.get(cacheKey) ?? clientIdx.resolve(mapped.client_name);
      if (!clientId) {
        // Communications-only import against a fresh DB: stub the client
        // so the history still lands. Tag as "jobber_import_communications"
        // to distinguish from the main client-list import.
        const { data: created, error: createErr } = await supabase
          .from("clients")
          .insert({
            name: mapped.client_name,
            email: mapped.email_address,
            source: "jobber_import_communications",
          })
          .select("id")
          .single();
        if (createErr || !created) {
          skipped++;
          addReason(
            reasons,
            `Row ${rowNumber}: failed to create client "${mapped.client_name}": ${createErr?.message ?? "unknown"}`
          );
          continue;
        }
        clientId = created.id;
        commClientsAutoCreated++;
      }
      if (!clientId) continue;
      commNameCache.set(cacheKey, clientId);
      if (mapped.external_id && existingExternal.has(mapped.external_id)) {
        skipped++;
        continue;
      }
      const startedAt = mapped.started_at ?? new Date().toISOString();
      const compositeKey = `${clientId}::${(mapped.subject ?? "").toLowerCase()}::${startedAt}`;
      if (!mapped.external_id && existingComposite.has(compositeKey)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("communications").insert({
        client_id: clientId,
        external_id: mapped.external_id,
        direction: mapped.direction,
        channel: "email",
        // phone_number is `not null` on the schema — use the contact email
        // as the best available identifier, or a placeholder.
        phone_number: mapped.email_address ?? "email",
        started_at: startedAt,
        subject: mapped.subject,
        body: mapped.body,
        email_address: mapped.email_address,
        thread_id: mapped.thread_id,
      });
      if (error) {
        if (/duplicate key/i.test(error.message)) {
          skipped++;
          continue;
        }
        skipped++;
        addReason(reasons, `Row ${rowNumber}: ${error.message}`);
        console.error(`[import:communications] row ${rowNumber}`, error);
        continue;
      }
      if (mapped.external_id) existingExternal.add(mapped.external_id);
      existingComposite.add(compositeKey);
      inserted++;
    }

    summary("communications", inserted, skipped, reasons);
    if (commClientsAutoCreated > 0) {
      console.log(
        `[import:communications] auto-created ${commClientsAutoCreated} client stub(s)`,
      );
      addReason(
        reasons,
        `Auto-created ${commClientsAutoCreated} client stub${
          commClientsAutoCreated === 1 ? "" : "s"
        } for communications without a matching client.`,
      );
    }
    revalidatePath("/dashboard/messages");
    return { ok: true, inserted, skipped, reasons };
  } catch (err) {
    console.error("[import:communications] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: requests (leads) ----------

export async function importRequestsAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];

    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name");
    if (clientsErr) {
      console.error("[import:requests] read clients failed", clientsErr);
      return {
        ok: false,
        error: `Failed to read clients: ${clientsErr.message}`,
      };
    }
    const clientIdx = buildNameIndex(clients ?? []);

    const { data: existing, error: existingErr } = await supabase
      .from("leads")
      .select("external_id, client_id, title, requested_on");
    if (existingErr) {
      console.error("[import:requests] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read leads: ${existingErr.message}`,
      };
    }
    const existingExternal = new Set(
      (existing ?? [])
        .map((r) => r.external_id)
        .filter((v): v is string => Boolean(v))
    );
    const existingComposite = new Set(
      (existing ?? []).map(
        (r) =>
          `${r.client_id ?? "null"}::${(r.title ?? "").toLowerCase()}::${r.requested_on ?? ""}`
      )
    );

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapRequestRow(rows[i]);
      if (!mapped) {
        skipped++;
        addReason(reasons, `Row ${rowNumber}: missing client name or title`);
        continue;
      }
      const clientId = mapped.client_name
        ? clientIdx.resolve(mapped.client_name)
        : null;

      if (mapped.external_id && existingExternal.has(mapped.external_id)) {
        skipped++;
        continue;
      }
      const composite = `${clientId ?? "null"}::${(mapped.title ?? "").toLowerCase()}::${mapped.requested_on ?? ""}`;
      if (!mapped.external_id && existingComposite.has(composite)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("leads").insert({
        source: "jobber_request",
        client_id: clientId,
        status: mapped.status,
        raw_payload: {},
        external_id: mapped.external_id,
        title: mapped.title,
        contact_name: mapped.contact_name,
        contact_phone: mapped.contact_phone,
        contact_email: mapped.contact_email,
        service_address: mapped.service_address,
        service_type: mapped.service_type,
        message: mapped.message,
        requested_on: mapped.requested_on,
        requested_price: mapped.requested_price,
        captured_at: mapped.requested_on ?? new Date().toISOString(),
      });
      if (error) {
        if (/duplicate key/i.test(error.message)) {
          skipped++;
          continue;
        }
        skipped++;
        addReason(reasons, `Row ${rowNumber}: ${error.message}`);
        console.error(`[import:requests] row ${rowNumber}`, error);
        continue;
      }
      if (mapped.external_id) existingExternal.add(mapped.external_id);
      existingComposite.add(composite);
      inserted++;
    }

    summary("requests", inserted, skipped, reasons);
    return { ok: true, inserted, skipped, reasons };
  } catch (err) {
    console.error("[import:requests] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- commit: feedback ----------

export async function importFeedbackAction(
  _prev: ImportResult | null,
  fd: FormData
): Promise<ImportResult> {
  try {
    await requireRole(["admin"]);
    const text = await readFile(fd);
    if (typeof text !== "string") return { ok: false, error: text.error };

    const supabase = createServiceRoleClient();
    const rows = parseCsv(text);
    let inserted = 0;
    let skipped = 0;
    const reasons: string[] = [];

    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name");
    if (clientsErr) {
      console.error("[import:feedback] read clients failed", clientsErr);
      return {
        ok: false,
        error: `Failed to read clients: ${clientsErr.message}`,
      };
    }
    const clientIdx = buildNameIndex(clients ?? []);

    const { data: projects } = await supabase
      .from("projects")
      .select("id, external_id")
      .not("external_id", "is", null);
    const projectByExternal = new Map(
      (projects ?? []).map((p) => [p.external_id as string, p.id])
    );

    const { data: existingAll, error: existingErr } = await supabase
      .from("client_feedback")
      .select("external_id, client_id, feedback_at, comment, score");
    if (existingErr) {
      console.error("[import:feedback] read existing failed", existingErr);
      return {
        ok: false,
        error: `Failed to read client_feedback: ${existingErr.message}`,
      };
    }
    const existingExternal = new Set(
      (existingAll ?? [])
        .map((r) => r.external_id)
        .filter((v): v is string => Boolean(v))
    );
    // Composite dedupe needs enough entropy that rows without
    // feedback_at / external_id don't all collapse to one bucket.
    // Hash client + date + score + first 60 chars of comment — that's
    // enough signal to match on re-imports but not so broad two
    // distinct reviews for the same customer on the same day collide.
    function compositeKey(
      clientId: string | null,
      feedbackAt: string | null,
      score: number | null,
      comment: string | null,
    ): string {
      const c = (comment ?? "").toLowerCase().trim().slice(0, 60);
      return `${clientId ?? "null"}::${feedbackAt ?? ""}::${score ?? ""}::${c}`;
    }
    const existingComposite = new Set(
      (existingAll ?? []).map((r) =>
        compositeKey(
          r.client_id as string | null,
          r.feedback_at as string | null,
          r.score as number | null,
          r.comment as string | null,
        ),
      ),
    );

    // Auto-create parent clients for orphan feedback rows so the
    // sentiment history still lands on a fresh DB.
    const feedbackNameCache = new Map<string, string>();
    let feedbackClientsAutoCreated = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const mapped = mapFeedbackRow(rows[i]);
      if (!mapped) {
        skipped++;
        addReason(reasons, `Row ${rowNumber}: missing score or comment`);
        continue;
      }
      let clientId: string | null = null;
      if (mapped.client_name) {
        const cacheKey = mapped.client_name.toLowerCase().trim();
        clientId =
          feedbackNameCache.get(cacheKey) ??
          clientIdx.resolve(mapped.client_name);
        if (!clientId) {
          const { data: created, error: createErr } = await supabase
            .from("clients")
            .insert({
              name: mapped.client_name,
              source: "jobber_import_feedback",
            })
            .select("id")
            .single();
          if (createErr || !created) {
            console.error(
              "[import:feedback] auto-create client failed",
              createErr,
            );
          } else {
            clientId = created.id;
            feedbackClientsAutoCreated++;
          }
        }
        if (clientId) feedbackNameCache.set(cacheKey, clientId);
      }
      const projectId = mapped.job_number
        ? projectByExternal.get(mapped.job_number) ?? null
        : null;

      if (mapped.external_id && existingExternal.has(mapped.external_id)) {
        skipped++;
        continue;
      }
      const composite = compositeKey(
        clientId,
        mapped.feedback_at,
        mapped.score,
        mapped.comment,
      );
      if (!mapped.external_id && existingComposite.has(composite)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("client_feedback").insert({
        client_id: clientId,
        project_id: projectId,
        external_id: mapped.external_id,
        score: mapped.score,
        score_type: mapped.score_type,
        comment: mapped.comment,
        feedback_at: mapped.feedback_at,
      });
      if (error) {
        if (/duplicate key/i.test(error.message)) {
          skipped++;
          continue;
        }
        skipped++;
        addReason(reasons, `Row ${rowNumber}: ${error.message}`);
        console.error(`[import:feedback] row ${rowNumber}`, error);
        continue;
      }
      if (mapped.external_id) existingExternal.add(mapped.external_id);
      existingComposite.add(composite);
      inserted++;
    }

    if (feedbackClientsAutoCreated > 0) {
      addReason(
        reasons,
        `Auto-created ${feedbackClientsAutoCreated} client stub${
          feedbackClientsAutoCreated === 1 ? "" : "s"
        } for feedback without a matching client.`,
      );
    }

    summary("feedback", inserted, skipped, reasons);
    return { ok: true, inserted, skipped, reasons };
  } catch (err) {
    console.error("[import:feedback] unhandled error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

// ---------- review staging ----------

/**
 * Drop an unmatched row into `import_review_rows` so Ronnie can fix it
 * at /dashboard/settings/import-review. Deduped by (kind, payload_hash)
 * — re-running the same CSV doesn't duplicate pending rows. Swallowed
 * on error: staging is a nice-to-have, never blocks an import.
 */
async function stageReviewRow(
  supabase: ReturnType<typeof createServiceRoleClient>,
  args: {
    kind: string;
    rowNumber: number;
    raw: Record<string, string>;
    payload: Record<string, unknown>;
    reason: string;
    suggestions: Array<{
      id: string;
      name: string;
      reason: string;
      distance: number;
    }>;
  },
): Promise<void> {
  try {
    const hashInput = JSON.stringify([args.kind, args.payload]);
    const hash = simpleHash(hashInput);
    await supabase.from("import_review_rows").upsert(
      {
        kind: args.kind,
        row_number: args.rowNumber,
        raw: args.raw,
        payload: args.payload,
        reason: args.reason,
        suggestions: args.suggestions,
        status: "pending",
        payload_hash: hash,
      },
      { onConflict: "kind,payload_hash" },
    );
  } catch (err) {
    console.error(`[import:${args.kind}] stageReviewRow failed`, err);
  }
}

/** Tiny stable hash — not cryptographic, just dedupe by content. */
function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}
