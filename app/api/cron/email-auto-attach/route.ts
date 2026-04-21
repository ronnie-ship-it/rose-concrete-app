import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";
import { getGmailAdapter } from "@/lib/gmail";
import { storageKeyFor } from "@/lib/attachments";

/**
 * Broader Gmail → client auto-attach. Different from
 * gmail-permit-scan (which is sidewalk-only, subject-keyword-driven):
 * this cron matches sender-by-email against every `clients.email` and
 * auto-attaches the email + any attachments to that client's record.
 * PDF attachments ALSO land on the client's most-recent active
 * project so plans / permits / Safe Sidewalks forms auto-file where
 * Ronnie expects them.
 *
 * Unmatched emails get written to `unmatched_emails` (created lazily
 * via upsert — table defined in the same migration if you want to
 * gate this route behind a feature flag later). For now, we log
 * unmatched + return counts in the response so the cron dashboard
 * shows Ronnie how many need manual review.
 *
 * Runs every 15 min.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const gmail = getGmailAdapter();
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const messages = await gmail.listRecent(since, 200);
  if (messages.length === 0) {
    return NextResponse.json({
      scanned: 0,
      note: "Gmail adapter stubbed or empty inbox.",
    });
  }

  // Build sender → client_id map.
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, email")
    .not("email", "is", null);
  const clientByEmail = new Map<string, string>();
  for (const c of clientRows ?? []) {
    if (c.email) clientByEmail.set((c.email as string).toLowerCase(), c.id as string);
  }

  // Build client_id → active project_id (most recent active) map for
  // PDF routing.
  const { data: activeProjects } = await supabase
    .from("projects")
    .select("id, client_id, created_at, status")
    .in("status", ["approved", "scheduled", "active"])
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const activeProjectByClient = new Map<string, string>();
  for (const p of activeProjects ?? []) {
    const cid = p.client_id as string;
    if (!activeProjectByClient.has(cid)) {
      activeProjectByClient.set(cid, p.id as string);
    }
  }

  let matchedEmails = 0;
  let attached = 0;
  let unmatched = 0;
  const unmatchedSamples: string[] = [];

  for (const m of messages) {
    const fromLower = extractEmail(m.from).toLowerCase();
    const clientId = clientByEmail.get(fromLower);
    if (!clientId) {
      unmatched++;
      if (unmatchedSamples.length < 10) unmatchedSamples.push(m.from);
      continue;
    }
    matchedEmails++;

    // Log the email in communications so it shows up in the client
    // feed. `external_id` = the Gmail message id so the row is
    // idempotent even if the cron re-runs over overlapping windows.
    await supabase.from("communications").upsert(
      {
        client_id: clientId,
        external_id: m.id,
        direction: "inbound",
        channel: "email",
        phone_number: fromLower,
        started_at: m.received_at ?? new Date().toISOString(),
        body:
          (m.subject ? `Subject: ${m.subject}\n\n` : "") +
          (m.snippet ?? ""),
      },
      { onConflict: "external_id" },
    );

    if (!m.has_attachments || !m.attachments?.length) continue;

    const activeProjectId = activeProjectByClient.get(clientId) ?? null;
    for (const att of m.attachments) {
      const bytes = await gmail.getAttachmentBytes(m.id, att.attachment_id);
      if (!bytes) continue;
      const isPdf = (att.mime_type ?? "").toLowerCase().includes("pdf");
      const target =
        isPdf && activeProjectId
          ? { entity_type: "project" as const, entity_id: activeProjectId }
          : { entity_type: "client" as const, entity_id: clientId };
      const key = storageKeyFor(target.entity_type, target.entity_id, att.filename);
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(key, bytes.bytes, {
          contentType: att.mime_type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        console.warn("[email-auto-attach] upload", upErr);
        continue;
      }
      const { error: insErr } = await supabase.from("attachments").insert({
        entity_type: target.entity_type,
        entity_id: target.entity_id,
        storage_key: key,
        filename: att.filename,
        mime_type: att.mime_type || "application/octet-stream",
        size_bytes: att.size_bytes,
        caption: `email auto-attach: ${m.subject?.slice(0, 140) ?? ""}`,
        uploaded_by: null,
      });
      if (insErr) {
        await supabase.storage.from("attachments").remove([key]);
        continue;
      }
      attached++;
    }
  }

  return NextResponse.json({
    scanned: messages.length,
    matched_emails: matchedEmails,
    attachments_saved: attached,
    unmatched,
    unmatched_samples: unmatchedSamples,
  });
}

/** Pull "foo@bar.com" out of "Full Name <foo@bar.com>". */
function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m?.[1] ?? from).trim();
}
