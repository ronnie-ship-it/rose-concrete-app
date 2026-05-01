import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getOpenPhoneAdapter,
  syncOpenPhoneCalls,
  syncOpenPhoneMessages,
  type OpenPhoneCall,
  type OpenPhoneMessage,
} from "@/lib/openphone";

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
 * As of feat/openphone-webhook this runs in tandem with the real-time
 * webhook at `/api/webhooks/openphone`. Both write through the shared
 * `syncOpenPhoneCalls` / `syncOpenPhoneMessages` helpers so they're
 * race-safe via the unique-index on `external_id`.
 *
 * When `OPENPHONE_API_KEY` is unset, `getOpenPhoneAdapter()` returns the
 * stub and this cron is a cheap no-op — safe to enable before the env
 * var lands.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_MINUTES = 30;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const adapter = getOpenPhoneAdapter();
  const since = new Date(
    Date.now() - LOOKBACK_MINUTES * 60 * 1000,
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
      { status: 502 },
    );
  }

  if (calls.length === 0 && messages.length === 0) {
    return NextResponse.json({ ok: true, calls: 0, messages: 0, since });
  }

  const callResult = await syncOpenPhoneCalls(supabase, calls);
  const msgResult = await syncOpenPhoneMessages(supabase, messages);

  const inserted = callResult.inserted + msgResult.inserted;
  const leads = callResult.leadsCreated + msgResult.leadsCreated;
  const missed = callResult.missedCallTasks + msgResult.missedCallTasks;
  const errors = [...callResult.errors, ...msgResult.errors];

  console.log(
    `[openphone-backfill] since=${since} comms=${inserted}` +
      ` leads=${leads} missedTasks=${missed}` +
      ` errors=${errors.length}`,
  );

  return NextResponse.json({
    ok: true,
    since,
    inserted_communications: inserted,
    created_leads: leads,
    missed_call_tasks: missed,
    errors,
  });
}
