"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { storageKeyFor } from "@/lib/attachments";
import {
  buildJobberAuthorizeUrl,
  refreshJobberTokens,
  fetchClientsPage,
  downloadAttachment,
  type JobberClient,
  type JobberTokenBundle,
} from "@/lib/jobber-api";

/**
 * Jobber GraphQL API importer — OAuth 2.0 + chunked note/attachment pull.
 *
 * Flow:
 *   1. Ronnie pastes his Jobber Developer Center client_id + client_secret
 *      into the credentials form. `saveJobberCredentialsAction` stores
 *      them on the singleton `jobber_oauth_tokens` row along with a CSRF
 *      state string, then redirects him to Jobber to authorize.
 *   2. Jobber bounces him to `/dashboard/settings/import/jobber-api/
 *      callback?code=...&state=...`. The callback route matches the state,
 *      exchanges the code+id+secret for an access_token + refresh_token,
 *      writes both back to the same row.
 *   3. The page shows "Connected ✓" and a "Start import" button.
 *   4. `runJobberImportTickAction` is called repeatedly by the client
 *      until `done=true`. Each tick: refreshes the access token if it's
 *      within 60 s of expiry, pulls one page of clients (with their last
 *      50 notes and noteAttachments), matches each client by name,
 *      writes notes + downloads/stores attachments, advances the cursor.
 *      Progress counters live on the `jobber_oauth_tokens` row so a page
 *      reload just resumes.
 */

const REDIRECT_PATH = "/dashboard/settings/import/jobber-api/callback";
const PAGE_PATH = "/dashboard/settings/import/jobber-api";

// Keep each tick well under Vercel's 60 s function cap. 15 clients × (50
// notes + maybe a few attachments) fits comfortably with attachment
// downloads dominating the wall clock.
const CLIENTS_PER_TICK = 15;
// Hard per-attachment size cap. Most Jobber photos are well under this.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type TickResult =
  | {
      ok: true;
      done: boolean;
      clients_processed: number;
      notes_imported: number;
      attachments_imported: number;
      skipped_clients: number;
      cursor: string | null;
      last_error: string | null;
    }
  | { ok: false; error: string };

// ---------- step 1: save credentials + redirect to Jobber authorize ----------

export async function saveJobberCredentialsAction(
  _prev: { ok: false; error: string } | null,
  fd: FormData
): Promise<{ ok: false; error: string } | never> {
  await requireRole(["admin"]);

  const clientId = String(fd.get("client_id") ?? "").trim();
  const clientSecret = String(fd.get("client_secret") ?? "").trim();
  if (!clientId || !clientSecret) {
    return { ok: false, error: "Both client ID and client secret are required." };
  }

  const appBase = process.env.APP_BASE_URL;
  if (!appBase) {
    return {
      ok: false,
      error:
        "APP_BASE_URL is not set. Ask the developer to set it so Jobber knows where to redirect.",
    };
  }

  const state = crypto.randomUUID();
  const supabase = createServiceRoleClient();

  // Single-row design: wipe any prior row, write a fresh one.
  await supabase.from("jobber_oauth_tokens").delete().neq("id", "");
  const { error } = await supabase.from("jobber_oauth_tokens").insert({
    client_id: clientId,
    client_secret: clientSecret,
    pending_state: state,
  });
  if (error) {
    console.error("[jobber-oauth] save credentials failed", error);
    return { ok: false, error: `Couldn't save credentials: ${error.message}` };
  }

  const redirectUri = `${appBase.replace(/\/$/, "")}${REDIRECT_PATH}`;
  const url = buildJobberAuthorizeUrl({
    clientId,
    redirectUri,
    state,
  });
  redirect(url);
}

// ---------- step 2: reset connection (from the page's Disconnect button) ----------

export async function disconnectJobberAction(): Promise<void> {
  await requireRole(["admin"]);
  const supabase = createServiceRoleClient();
  await supabase.from("jobber_oauth_tokens").delete().neq("id", "");
  revalidatePath(PAGE_PATH);
}

// ---------- step 3: the import tick ----------

type TokenRow = {
  id: string;
  client_id: string;
  client_secret: string;
  access_token: string | null;
  refresh_token: string | null;
  access_expires_at: string | null;
  import_cursor: string | null;
  clients_processed: number;
  notes_imported: number;
  attachments_imported: number;
};

async function ensureFreshAccessToken(
  supabase: ReturnType<typeof createServiceRoleClient>,
  row: TokenRow
): Promise<
  | { ok: true; accessToken: string }
  | { ok: false; error: string }
> {
  if (!row.refresh_token || !row.access_token || !row.access_expires_at) {
    return {
      ok: false,
      error: "Not connected to Jobber yet — finish the OAuth step first.",
    };
  }
  const expiresAt = new Date(row.access_expires_at).getTime();
  const now = Date.now();
  // 60 s safety window so we don't hit the first real GraphQL call with
  // an about-to-expire token.
  if (expiresAt - now > 60_000) {
    return { ok: true, accessToken: row.access_token };
  }
  const refreshed = await refreshJobberTokens({
    clientId: row.client_id,
    clientSecret: row.client_secret,
    refreshToken: row.refresh_token,
  });
  if (!refreshed.ok) return { ok: false, error: refreshed.error };
  await persistTokens(supabase, row.id, refreshed.tokens);
  return { ok: true, accessToken: refreshed.tokens.access_token };
}

async function persistTokens(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rowId: string,
  tokens: JobberTokenBundle
): Promise<void> {
  await supabase
    .from("jobber_oauth_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_expires_at: tokens.expires_at,
      last_error: null,
    })
    .eq("id", rowId);
}

export async function runJobberImportTickAction(): Promise<TickResult> {
  try {
    await requireRole(["admin"]);
    const supabase = createServiceRoleClient();

    const { data: row, error: readErr } = await supabase
      .from("jobber_oauth_tokens")
      .select(
        "id, client_id, client_secret, access_token, refresh_token, access_expires_at, import_cursor, clients_processed, notes_imported, attachments_imported"
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readErr) {
      return { ok: false, error: `Read tokens: ${readErr.message}` };
    }
    if (!row) {
      return { ok: false, error: "No Jobber credentials saved yet." };
    }
    const tokenRow = row as TokenRow;

    // Mark the import as started on the first tick.
    if (tokenRow.clients_processed === 0 && !tokenRow.import_cursor) {
      await supabase
        .from("jobber_oauth_tokens")
        .update({ import_started_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
    }

    const tokenRes = await ensureFreshAccessToken(supabase, tokenRow);
    if (!tokenRes.ok) return { ok: false, error: tokenRes.error };

    const pageRes = await fetchClientsPage(
      tokenRes.accessToken,
      tokenRow.import_cursor,
      CLIENTS_PER_TICK
    );
    if (!pageRes.ok) {
      await supabase
        .from("jobber_oauth_tokens")
        .update({ last_error: pageRes.error })
        .eq("id", tokenRow.id);
      return { ok: false, error: pageRes.error };
    }

    // Name → client_id map built once for this tick. Anything Jobber
    // reports that we don't have gets skipped with a reason.
    const { data: localClients, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name, jobber_id");
    if (clientsErr) {
      return { ok: false, error: `Read clients: ${clientsErr.message}` };
    }
    const byName = new Map<string, string>();
    const byJobberId = new Map<string, string>();
    for (const c of localClients ?? []) {
      if (c.name) byName.set(c.name.toLowerCase().trim(), c.id);
      if (c.jobber_id) byJobberId.set(c.jobber_id, c.id);
    }

    let notesImported = 0;
    let attachmentsImported = 0;
    let skippedClients = 0;

    for (const jc of pageRes.page.clients) {
      const matchedId =
        byJobberId.get(jc.id) ??
        byName.get(jc.name.toLowerCase().trim()) ??
        null;
      if (!matchedId) {
        skippedClients++;
        continue;
      }
      // Stamp the Jobber node id on the local client so future ticks
      // match in O(1) without relying on name.
      if (!byJobberId.has(jc.id)) {
        await supabase
          .from("clients")
          .update({ jobber_id: jc.id })
          .eq("id", matchedId);
        byJobberId.set(jc.id, matchedId);
      }
      notesImported += await importNotes(supabase, matchedId, jc);
      attachmentsImported += await importAttachments(supabase, matchedId, jc);
    }

    const newClientsProcessed =
      tokenRow.clients_processed + pageRes.page.clients.length;
    const newNotes = tokenRow.notes_imported + notesImported;
    const newAttachments = tokenRow.attachments_imported + attachmentsImported;
    const done = !pageRes.page.hasNextPage;

    await supabase
      .from("jobber_oauth_tokens")
      .update({
        import_cursor: done ? null : pageRes.page.nextCursor,
        clients_processed: newClientsProcessed,
        notes_imported: newNotes,
        attachments_imported: newAttachments,
        import_finished_at: done ? new Date().toISOString() : null,
        last_error: null,
      })
      .eq("id", tokenRow.id);

    console.log(
      `[jobber-api] tick — page=${pageRes.page.clients.length}` +
        ` totalClients=${newClientsProcessed}` +
        ` notes+=${notesImported} attachments+=${attachmentsImported}` +
        ` skippedUnmatched=${skippedClients} done=${done}`
    );

    return {
      ok: true,
      done,
      clients_processed: newClientsProcessed,
      notes_imported: newNotes,
      attachments_imported: newAttachments,
      skipped_clients: skippedClients,
      cursor: pageRes.page.nextCursor,
      last_error: null,
    };
  } catch (err) {
    console.error("[jobber-api] tick unhandled", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected import failure.",
    };
  }
}

async function importNotes(
  supabase: ReturnType<typeof createServiceRoleClient>,
  clientId: string,
  jc: JobberClient
): Promise<number> {
  if (jc.notes.length === 0) return 0;

  // Pre-check which Jobber note ids already exist so we do one bulk insert
  // per client instead of N round trips.
  const { data: existing } = await supabase
    .from("notes")
    .select("external_id")
    .in(
      "external_id",
      jc.notes.map((n) => n.id)
    );
  const existingIds = new Set(
    (existing ?? [])
      .map((r) => r.external_id)
      .filter((v): v is string => Boolean(v))
  );

  const toInsert = jc.notes
    .filter((n) => !existingIds.has(n.id) && n.message && n.message.trim())
    .map((n) => ({
      entity_type: "client" as const,
      entity_id: clientId,
      kind: "internal" as const,
      body: n.author ? `${n.message}\n\n— ${n.author}` : n.message,
      external_id: n.id,
      created_at: n.createdAt,
    }));
  if (toInsert.length === 0) return 0;

  const { error, data } = await supabase
    .from("notes")
    .insert(toInsert)
    .select("id");
  if (error) {
    console.error("[jobber-api] note insert failed", error);
    return 0;
  }
  return data?.length ?? 0;
}

async function importAttachments(
  supabase: ReturnType<typeof createServiceRoleClient>,
  clientId: string,
  jc: JobberClient
): Promise<number> {
  if (jc.noteAttachments.length === 0) return 0;

  const { data: existing } = await supabase
    .from("attachments")
    .select("external_id")
    .in(
      "external_id",
      jc.noteAttachments.map((a) => a.id)
    );
  const existingIds = new Set(
    (existing ?? [])
      .map((r) => r.external_id)
      .filter((v): v is string => Boolean(v))
  );

  let inserted = 0;
  for (const att of jc.noteAttachments) {
    if (existingIds.has(att.id)) continue;
    const dl = await downloadAttachment(att.url, MAX_ATTACHMENT_BYTES);
    if (!dl.ok) {
      console.error(
        `[jobber-api] attachment download skipped ${att.id}: ${dl.error}`
      );
      continue;
    }
    const key = storageKeyFor("client", clientId, att.fileName);
    const { error: uploadErr } = await supabase.storage
      .from("attachments")
      .upload(key, dl.bytes, {
        contentType: dl.contentType ?? att.contentType,
        upsert: false,
      });
    if (uploadErr) {
      console.error(
        `[jobber-api] storage upload failed ${att.id}:`,
        uploadErr
      );
      continue;
    }
    const { error: rowErr } = await supabase.from("attachments").insert({
      entity_type: "client",
      entity_id: clientId,
      storage_key: key,
      filename: att.fileName,
      mime_type: dl.contentType ?? att.contentType,
      size_bytes: dl.bytes.length,
      external_id: att.id,
      created_at: att.createdAt,
    });
    if (rowErr) {
      console.error("[jobber-api] attachment row insert failed", rowErr);
      // Best-effort cleanup so a row-less blob doesn't waste storage.
      await supabase.storage.from("attachments").remove([key]);
      continue;
    }
    inserted++;
  }
  return inserted;
}
