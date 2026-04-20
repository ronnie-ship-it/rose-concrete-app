import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";
import { storageKeyFor } from "@/lib/attachments";

/**
 * OpenPhone MMS → client attachments auto-save.
 *
 * Every 15 min: scan recent OpenPhone inbound messages. Any message
 * whose phone number matches a known client AND carries media_urls
 * downloads each media item and stores it as an attachment on the
 * client record. Shows up in the client communications feed (because
 * the openphone-backfill cron already writes the message row to
 * `communications`, we just supplement with attachments).
 *
 * Requires the real OpenPhone adapter to populate `media_urls` on
 * messages. When that field is empty (stub or no MMS this window),
 * the cron is a cheap no-op.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (
    request.headers.get("authorization") !==
      `Bearer ${process.env.CRON_SECRET}` &&
    request.headers.get("x-vercel-cron") !== "1"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const adapter = getOpenPhoneAdapter();
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  // Use the broad backfill helper since the adapter interface exposes
  // it for per-number polling. Grab everything across all numbers.
  const messages = await adapter.listMessagesSince(since);
  if (!messages || messages.length === 0) {
    return NextResponse.json({ scanned: 0 });
  }

  // phone → client map — same normalization used by the backfill cron
  // so "(619) 555-1234" and "+16195551234" match the same row.
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, phone")
    .not("phone", "is", null);
  const byPhone = new Map<string, string>();
  for (const c of clientRows ?? []) {
    const norm = normalizePhone(c.phone as string);
    if (norm) byPhone.set(norm, c.id as string);
  }

  let attached = 0;
  let skipped = 0;
  let processed = 0;

  for (const m of messages) {
    if (m.direction !== "inbound") continue;
    if (!m.media_urls || m.media_urls.length === 0) {
      skipped++;
      continue;
    }
    const norm = normalizePhone(m.phone_number);
    const clientId = norm ? byPhone.get(norm) : null;
    if (!clientId) {
      skipped++;
      continue;
    }
    processed++;
    for (let i = 0; i < m.media_urls.length; i++) {
      const url = m.media_urls[i];
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const buf = new Uint8Array(await resp.arrayBuffer());
        const mime = resp.headers.get("content-type") ?? "image/jpeg";
        const ext = (mime.split("/")[1] ?? "jpg").split(";")[0];
        const filename = `openphone-${m.external_id}-${i}.${ext}`;
        const key = storageKeyFor("client", clientId, filename);
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(key, buf, { contentType: mime, upsert: false });
        if (upErr) continue;
        const { error: insErr } = await supabase.from("attachments").insert({
          entity_type: "client",
          entity_id: clientId,
          storage_key: key,
          filename,
          mime_type: mime,
          size_bytes: buf.length,
          caption: `openphone MMS from ${m.phone_number}`,
          uploaded_by: null,
        });
        if (insErr) {
          await supabase.storage.from("attachments").remove([key]);
          continue;
        }
        attached++;
      } catch (err) {
        console.warn("[openphone-media-attach] fetch failed", err);
      }
    }
  }

  return NextResponse.json({
    scanned: messages.length,
    processed,
    attached,
    skipped,
  });
}
