import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { normalizePhone } from "@/lib/openphone";

/**
 * STUB — call-tracking webhook endpoint.
 *
 * Provider-agnostic intake for inbound call events. When Ronnie picks a
 * provider (CallRail, OpenPhone webhook, etc.), the integration session
 * maps the provider's webhook payload to the `CallEvent` shape below and
 * sets `CALL_TRACKING_WEBHOOK_SECRET` to authenticate.
 *
 * Today this:
 *   1. Accepts POST with the standard `CallEvent` shape.
 *   2. Validates a shared secret header (returns 401 if `CALL_TRACKING_WEBHOOK_SECRET`
 *      is unset OR doesn't match — fail-closed).
 *   3. Inserts a row into `calls`.
 *   4. Tries to attach to an existing client by phone match.
 *
 * Returns 200 with `{ ok: true, call_id }` on success.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CallEvent = {
  external_id?: string;
  direction?: "inbound" | "outbound";
  caller_phone?: string;
  called_phone?: string;
  source_page?: string;
  duration_s?: number;
  recording_url?: string;
  transcript?: string;
  status?:
    | "completed"
    | "missed"
    | "voicemail"
    | "busy"
    | "no_answer"
    | "failed";
  started_at?: string;
  ended_at?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const expected = process.env.CALL_TRACKING_WEBHOOK_SECRET;
  if (!expected) {
    return json({ ok: false, error: "Call tracking not configured" }, 503);
  }
  if (req.headers.get("x-rose-secret") !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: CallEvent;
  try {
    body = (await req.json()) as CallEvent;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const callerPhone = normalizePhone(body.caller_phone);
  if (!callerPhone) {
    return json({ ok: false, error: "caller_phone required" }, 400);
  }

  const supabase = createServiceRoleClient();

  // Match to an existing client by phone — best-effort, doesn't block the insert.
  let clientId: string | null = null;
  const { data: matchClient } = await supabase
    .from("clients")
    .select("id")
    .eq("phone", callerPhone)
    .limit(1)
    .maybeSingle();
  if (matchClient) clientId = matchClient.id;

  const { data: call, error } = await supabase
    .from("calls")
    .insert({
      external_id: body.external_id ?? null,
      direction: body.direction ?? "inbound",
      caller_phone: callerPhone,
      called_phone: normalizePhone(body.called_phone),
      source_page: body.source_page ?? null,
      duration_s: body.duration_s ?? null,
      recording_url: body.recording_url ?? null,
      transcript: body.transcript ?? null,
      status: body.status ?? null,
      client_id: clientId,
      raw_payload: body as unknown as Record<string, unknown>,
      started_at: body.started_at ?? new Date().toISOString(),
      ended_at: body.ended_at ?? null,
    })
    .select("id")
    .single();

  if (error || !call) {
    return json({ ok: false, error: error?.message ?? "insert failed" }, 500);
  }

  return json({ ok: true, call_id: call.id, client_id: clientId });
}

export async function GET() {
  return json({
    ok: true,
    service: "rose-concrete inbound call tracking webhook (stub)",
    configured: !!process.env.CALL_TRACKING_WEBHOOK_SECRET,
  });
}
