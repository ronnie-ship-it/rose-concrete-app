import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getOpenPhoneAdapter,
  normalizePhone,
  phoneMatchVariants,
  type OpenPhoneCall,
  type OpenPhoneMessage,
} from "@/lib/openphone";
import { createLead } from "@/lib/leads";

/**
 * OpenPhone backfill — every 15 min pulls the last 30 min of calls + texts
 * from OpenPhone's REST API and turns them into `communications` rows tied
 * to a client (by phone match). Unknown numbers auto-create a stub client
 * + `leads` row so nothing gets lost. Missed inbound calls also seed a
 * `tasks` row so Ronnie sees them on the dashboard.
 *
 * Idempotency is by `communications.external_id` (unique). Re-running
 * within the same 30 min window is a no-op. The 30-min window overlaps
 * the 15-min cadence on purpose so a single late poll doesn't drop rows.
 *
 * When `OPENPHONE_API_KEY` is unset, `getOpenPhoneAdapter()` returns the
 * stub and this cron is a cheap no-op — safe to enable before the env
 * var lands.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_MINUTES = 30;

type ClientRow = { id: string; phone: string | null; name: string };

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

  const adapter = getOpenPhoneAdapter();
  const since = new Date(
    Date.now() - LOOKBACK_MINUTES * 60 * 1000
  ).toISOString();

  let calls: OpenPhoneCall[] = [];
  let messages: OpenPhoneMessage[] = [];
  try {
    [calls, messages] = await Promise.all([
      adapter.listCallsSince(since),
      adapter.listMessagesSince(since),
    ]);
  } catch (err) {
    console.error("[openphone-backfill] adapter fetch failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }

  if (calls.length === 0 && messages.length === 0) {
    return NextResponse.json({ ok: true, calls: 0, messages: 0, since });
  }

  // Load every client once so we can match by phone without per-row queries.
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, phone, name");
  if (clientsErr) {
    console.error("[openphone-backfill] read clients failed", clientsErr);
    return NextResponse.json(
      { error: `Read clients: ${clientsErr.message}` },
      { status: 500 }
    );
  }

  // Build a lookup from any phone-variant → client_id. Jobber phone
  // formatting varies wildly, so we index every variant we can compute.
  const phoneToClientId = new Map<string, string>();
  for (const c of (clients ?? []) as ClientRow[]) {
    for (const v of phoneMatchVariants(c.phone)) {
      if (!phoneToClientId.has(v)) phoneToClientId.set(v, c.id);
    }
  }

  function lookupClientId(phone: string): string | null {
    for (const v of phoneMatchVariants(phone)) {
      const id = phoneToClientId.get(v);
      if (id) return id;
    }
    return null;
  }

  // Pre-load existing external_ids so we don't round-trip per-row later.
  const allExternalIds = [
    ...calls.map((c) => c.external_id),
    ...messages.map((m) => m.external_id),
  ];
  const { data: dupRows } = allExternalIds.length
    ? await supabase
        .from("communications")
        .select("external_id")
        .in("external_id", allExternalIds)
    : { data: [] as { external_id: string | null }[] };
  const seenExternal = new Set(
    (dupRows ?? []).map((r) => r.external_id).filter(Boolean) as string[]
  );

  let insertedComms = 0;
  let createdLeads = 0;
  let missedTasks = 0;
  const errors: string[] = [];

  async function ensureClientForUnknown(
    phone: string,
  ): Promise<string | null> {
    const normalized = normalizePhone(phone) ?? phone;
    // Delegate to the shared createLead pipeline — same side-effects as
    // a web-form lead (project stub, draft quote, task, notifications,
    // instant confirmation SMS). Idempotent by (source, phone, 1h).
    const result = await createLead(
      {
        source: "openphone_inbound",
        phone: normalized,
        name: null,
        email: null,
        raw_payload: { phone: normalized, intake: "openphone_backfill" },
      },
      supabase,
    );
    if (!result.ok) {
      console.error("[openphone-backfill] createLead failed", result.error);
      return null;
    }
    if (!result.duplicate) createdLeads++;
    const clientId = result.duplicate
      ? (
          await supabase
            .from("leads")
            .select("client_id")
            .eq("id", result.lead_id)
            .maybeSingle()
        ).data?.client_id ?? null
      : result.client_id;
    if (clientId) {
      for (const v of phoneMatchVariants(normalized)) {
        phoneToClientId.set(v, clientId);
      }
    }
    return clientId;
  }

  async function seedMissedCallTask(
    clientId: string,
    call: OpenPhoneCall
  ): Promise<void> {
    const phone = normalizePhone(call.phone_number) ?? call.phone_number;
    const { error } = await supabase.from("tasks").insert({
      title: `Missed call from ${phone}`,
      body: call.recording_url
        ? `Voicemail: ${call.recording_url}`
        : "No voicemail.",
      client_id: clientId,
      source: "missed_call",
      source_id: call.external_id,
      status: "open",
    });
    if (error) {
      console.error("[openphone-backfill] task insert failed", error);
      errors.push(`task: ${error.message}`);
    } else {
      missedTasks++;
    }
  }

  // ---------- process calls ----------
  for (const call of calls) {
    if (call.external_id && seenExternal.has(call.external_id)) continue;
    let clientId = lookupClientId(call.phone_number);
    if (!clientId) {
      clientId = await ensureClientForUnknown(call.phone_number);
    }
    const { error } = await supabase.from("communications").insert({
      client_id: clientId,
      external_id: call.external_id,
      direction: call.direction,
      channel: "call",
      phone_number: normalizePhone(call.phone_number) ?? call.phone_number,
      started_at: call.started_at,
      duration_s: call.duration_s,
      recording_url: call.recording_url,
      transcript: call.transcript,
      was_missed: call.was_missed,
    });
    if (error) {
      // Unique constraint race — safe to ignore.
      if (!/duplicate key/i.test(error.message)) {
        console.error("[openphone-backfill] comm call insert failed", error);
        errors.push(`call ${call.external_id}: ${error.message}`);
      }
      continue;
    }
    seenExternal.add(call.external_id);
    insertedComms++;

    if (call.was_missed && clientId) {
      await seedMissedCallTask(clientId, call);
    }
  }

  // ---------- process messages ----------
  for (const msg of messages) {
    if (msg.external_id && seenExternal.has(msg.external_id)) continue;
    let clientId = lookupClientId(msg.phone_number);
    if (!clientId) {
      clientId = await ensureClientForUnknown(msg.phone_number);
    }
    const { error } = await supabase.from("communications").insert({
      client_id: clientId,
      external_id: msg.external_id,
      direction: msg.direction,
      channel: "sms",
      phone_number: normalizePhone(msg.phone_number) ?? msg.phone_number,
      started_at: msg.started_at,
      body: msg.body,
    });
    if (error) {
      if (!/duplicate key/i.test(error.message)) {
        console.error("[openphone-backfill] comm sms insert failed", error);
        errors.push(`sms ${msg.external_id}: ${error.message}`);
      }
      continue;
    }
    seenExternal.add(msg.external_id);
    insertedComms++;
  }

  console.log(
    `[openphone-backfill] since=${since} comms=${insertedComms}` +
      ` leads=${createdLeads} missedTasks=${missedTasks}` +
      ` errors=${errors.length}`
  );

  return NextResponse.json({
    ok: true,
    since,
    inserted_communications: insertedComms,
    created_leads: createdLeads,
    missed_call_tasks: missedTasks,
    errors,
  });
}
