import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getCallTranscript,
  mapCall,
  mapMessage,
  syncOpenPhoneCalls,
  syncOpenPhoneMessages,
  updateCallTranscript,
  verifyOpenPhoneSignature,
  type OpenPhoneApiCall,
  type OpenPhoneApiMessage,
} from "@/lib/openphone";

/**
 * Real-time OpenPhone webhook receiver.
 *
 * Subscribes to: call.completed, call.transcript.completed,
 * message.received, message.delivered. Other events are accepted (200)
 * but ignored — keeps the surface small.
 *
 * Auth: HMAC-SHA256 over `<timestamp>.<stripped_body>` with the
 * base64-decoded signing key Quo gives at webhook creation. Set
 * `OPENPHONE_WEBHOOK_SIGNING_KEY` in Vercel env vars after registering
 * the webhook in the Quo dashboard. Until set, the route fails-closed
 * with 503 so misconfiguration can never silently bypass auth.
 *
 * Runs in tandem with `/api/cron/openphone-backfill` (every 15 min).
 * Both write through the shared `syncOpenPhoneCalls` / `syncOpenPhoneMessages`
 * helpers; double-delivery is safe via the unique index on
 * `communications.external_id`.
 *
 * GET on this route returns a small health payload (no secrets) so the
 * URL can be sanity-checked from a browser before pasting it into Quo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type OpenPhoneEvent = {
  id?: string;
  type?: string;
  apiVersion?: string;
  createdAt?: string;
  data?: {
    object?: unknown;
  };
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "rose-concrete openphone webhook",
    configured: {
      OPENPHONE_API_KEY: !!process.env.OPENPHONE_API_KEY,
      OPENPHONE_WEBHOOK_SIGNING_KEY:
        !!process.env.OPENPHONE_WEBHOOK_SIGNING_KEY,
    },
    subscribes_to: [
      "call.completed",
      "call.transcript.completed",
      "message.received",
      "message.delivered",
    ],
  });
}

export async function POST(req: NextRequest) {
  const signingKey = process.env.OPENPHONE_WEBHOOK_SIGNING_KEY ?? "";
  if (!signingKey) {
    return NextResponse.json(
      { ok: false, error: "Webhook not configured (signing key missing)" },
      { status: 503 },
    );
  }

  // Read raw body for HMAC verification — order matters; once we call
  // req.json() we lose the exact bytes that were signed.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("openphone-signature");

  const verified = verifyOpenPhoneSignature({
    rawBody,
    signatureHeader,
    signingKey,
  });
  if (!verified.ok) {
    console.warn("[openphone-webhook] signature verification failed:", verified.reason);
    return NextResponse.json(
      { ok: false, error: `Signature verification failed: ${verified.reason}` },
      { status: 401 },
    );
  }

  let event: OpenPhoneEvent;
  try {
    event = JSON.parse(rawBody) as OpenPhoneEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const eventType = event.type ?? "";
  const eventId = event.id ?? "(no id)";

  // First-event observability — log event shape so the next session
  // can verify field names without redeploying. Quo's docs are vague
  // on the exact wrapper shape; this lets us iterate. Trim to first
  // 1000 chars so payloads don't flood logs forever.
  console.log(
    `[openphone-webhook] type=${eventType} id=${eventId} payload=`,
    rawBody.slice(0, 1000),
  );

  const supabase = createServiceRoleClient();

  try {
    switch (eventType) {
      case "call.completed": {
        const apiCall = (event.data?.object ?? null) as OpenPhoneApiCall | null;
        if (!apiCall || !apiCall.id) {
          return NextResponse.json(
            { ok: false, error: "call.completed missing data.object" },
            { status: 400 },
          );
        }
        const mapped = mapCall(apiCall);
        const result = await syncOpenPhoneCalls(supabase, [mapped]);
        return NextResponse.json({ ok: true, type: eventType, ...result });
      }
      case "call.transcript.completed": {
        // Quo may include transcript inline OR require a follow-up GET.
        // Try inline first; fall back to the API.
        const obj = (event.data?.object ?? null) as
          | (OpenPhoneApiCall & {
              transcript?: string;
              dialogue?: Array<{ content?: string; speaker?: string }>;
            })
          | null;
        const callId = obj?.id ?? "";
        if (!callId) {
          return NextResponse.json(
            { ok: false, error: "transcript event missing call id" },
            { status: 400 },
          );
        }
        let transcript: string | null = null;
        if (typeof obj?.transcript === "string") {
          transcript = obj.transcript;
        } else if (obj?.dialogue?.length) {
          transcript = obj.dialogue
            .map((d) => `${d.speaker ?? "?"}: ${d.content ?? ""}`)
            .join("\n");
        }
        if (!transcript) {
          transcript = await getCallTranscript(callId);
        }
        const updated = await updateCallTranscript(supabase, callId, transcript);
        return NextResponse.json({
          ok: true,
          type: eventType,
          call_id: callId,
          updated,
          had_inline_transcript: typeof obj?.transcript === "string",
        });
      }
      case "message.received":
      case "message.delivered": {
        const apiMsg = (event.data?.object ?? null) as
          | OpenPhoneApiMessage
          | null;
        if (!apiMsg || !apiMsg.id) {
          return NextResponse.json(
            { ok: false, error: `${eventType} missing data.object` },
            { status: 400 },
          );
        }
        const mapped = mapMessage(apiMsg);
        const result = await syncOpenPhoneMessages(supabase, [mapped]);
        return NextResponse.json({ ok: true, type: eventType, ...result });
      }
      default:
        // Quo may add events we don't subscribe to or that we just ignore
        // (e.g. call.ringing). 200 keeps Quo from retrying.
        return NextResponse.json({ ok: true, type: eventType, ignored: true });
    }
  } catch (err) {
    console.error("[openphone-webhook] handler threw", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Handler error",
      },
      { status: 500 },
    );
  }
}
