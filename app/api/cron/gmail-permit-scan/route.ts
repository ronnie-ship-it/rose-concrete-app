import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailAdapter } from "@/lib/gmail";
import { storageKeyFor } from "@/lib/attachments";

/**
 * Gmail → sidewalk-permit auto-attach.
 *
 * Every 15 min: scan Gmail inbox for messages with "permit" or "survey"
 * in the subject. For each one, try to match it to an active sidewalk
 * project — current heuristics:
 *   1. Subject mentions a permit number that matches
 *      `project_workflow_steps.metadata->>permit_number`.
 *   2. Sender email matches `clients.email` of an active sidewalk project.
 *
 * If exactly one project matches, every attachment is saved to Storage
 * under `attachments/project/<project_id>/...` and an `attachments` row
 * is inserted with caption `gmail:<subject>` so Ronnie can see where it
 * came from.
 *
 * Today the Gmail adapter is a stub (returns no messages) so this cron
 * is a no-op. When GMAIL_OAUTH_* lands, flip `createStubGmailAdapter` →
 * real MCP adapter and the pipeline lights up without any other change.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUBJECT_TRIGGERS = /\b(permit|survey|sidewalk)\b/i;
const PERMIT_NUMBER_REGEX = /\b([A-Z0-9]{2,4}-\d{3,8})\b/;

export async function GET(request: NextRequest) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const gmail = getGmailAdapter();
  const since = new Date(Date.now() - 30 * 60 * 1000); // last 30 min
  const messages = await gmail.listRecent(since, 100);
  const candidates = messages.filter(
    (m) => SUBJECT_TRIGGERS.test(m.subject) && m.has_attachments
  );

  if (candidates.length === 0) {
    return NextResponse.json({
      scanned: messages.length,
      matched: 0,
      note:
        messages.length === 0
          ? "Gmail adapter is stubbed — wire GMAIL_OAUTH_* to enable."
          : "No subjects matched triggers.",
    });
  }

  // Load active sidewalk projects + their email/permit_number fingerprints.
  const { data: sidewalkProjects } = await supabase
    .from("projects")
    .select(
      "id, name, client:clients(email), steps:project_workflow_steps(metadata)"
    )
    .eq("service_type", "sidewalk")
    .not("status", "in", "(done,cancelled)");

  type ProjectFingerprint = {
    id: string;
    email: string | null;
    permitNumbers: string[];
  };
  const fingerprints: ProjectFingerprint[] = (sidewalkProjects ?? []).map(
    (p) => {
      const client = Array.isArray(p.client) ? p.client[0] : p.client;
      const steps = (p.steps ?? []) as { metadata: Record<string, unknown> }[];
      const permitNumbers = steps
        .map((s) => (s.metadata?.permit_number as string | undefined) ?? "")
        .filter((x) => x);
      return {
        id: p.id as string,
        email: (client?.email as string | null | undefined) ?? null,
        permitNumbers,
      };
    }
  );

  // Watched senders: any email from these addresses routes to the single
  // active sidewalk project (if exactly one exists).
  const { data: watched } = await supabase
    .from("gmail_watched_senders")
    .select("email")
    .eq("is_active", true);
  const watchedSet = new Set(
    ((watched as Array<{ email: string }> | null) ?? []).map((w) =>
      w.email.toLowerCase(),
    ),
  );
  const activeSidewalkCount = fingerprints.length;

  let attached = 0;
  for (const m of candidates) {
    let match = matchToProject(m, fingerprints);
    if (!match) {
      const fromLower = m.from.toLowerCase();
      const fromWatched = Array.from(watchedSet).some((w) =>
        fromLower.includes(w),
      );
      if (fromWatched && activeSidewalkCount === 1) {
        match = { id: fingerprints[0].id };
      }
    }
    if (!match) continue;

    for (const att of m.attachments) {
      const bytes = await gmail.getAttachmentBytes(m.id, att.attachment_id);
      if (!bytes) continue;
      const key = storageKeyFor("project", match.id, att.filename);
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(key, bytes.bytes, {
          contentType: att.mime_type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        console.error("[gmail-permit-scan] storage", upErr);
        continue;
      }
      const { error: insErr } = await supabase.from("attachments").insert({
        entity_type: "project",
        entity_id: match.id,
        storage_key: key,
        filename: att.filename,
        mime_type: att.mime_type || "application/octet-stream",
        size_bytes: att.size_bytes,
        caption: `gmail: ${m.subject.slice(0, 160)}`,
        uploaded_by: null,
      });
      if (insErr) {
        await supabase.storage.from("attachments").remove([key]);
        console.error("[gmail-permit-scan] insert", insErr);
        continue;
      }
      attached++;
    }
  }

  return NextResponse.json({
    scanned: messages.length,
    candidates: candidates.length,
    attached,
  });
}

function matchToProject(
  msg: { subject: string; from: string },
  fingerprints: { id: string; email: string | null; permitNumbers: string[] }[]
): { id: string } | null {
  const permit = msg.subject.match(PERMIT_NUMBER_REGEX)?.[1];
  if (permit) {
    const byPermit = fingerprints.filter((f) =>
      f.permitNumbers.some((pn) => pn === permit)
    );
    if (byPermit.length === 1) return { id: byPermit[0].id };
  }
  const fromLower = msg.from.toLowerCase();
  const byEmail = fingerprints.filter(
    (f) => f.email && fromLower.includes(f.email.toLowerCase())
  );
  if (byEmail.length === 1) return { id: byEmail[0].id };
  return null;
}
