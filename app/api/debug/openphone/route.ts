import { NextResponse, type NextRequest } from "next/server";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

/**
 * Dev-only diagnostic endpoint for the OpenPhone outbound SMS path.
 *
 * Why this exists: createLead() swallows the SMS adapter's error and just
 * returns `{ sms: false }`, which is the right behavior for a public form
 * (don't break the user's submission because OpenPhone is down) but makes
 * it impossible to figure out *why* a send failed. This route surfaces
 * the raw response so we can debug auth/number-pinning/rate-limit issues.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/_debug/openphone \
 *     -H "content-type: application/json" \
 *     -d '{"phone":"+16195551234","body":"hello from debug"}'
 *
 * Hard-blocked in production via NODE_ENV check so this can't leak SMS
 * sending capability if it ever ships to Vercel by accident.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function blockedInProd(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available in production." }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = blockedInProd();
  if (blocked) return blocked;

  const adapter = getOpenPhoneAdapter();
  const apiKeySet = !!process.env.OPENPHONE_API_KEY;
  const phoneNumberId = process.env.OPENPHONE_PHONE_NUMBER_ID || null;

  // Probe what numbers the adapter sees on the account by calling the
  // private `phoneNumbers()` cache via a backdoor: invoke a no-match
  // sendMessage so we can read what the adapter would have used. Cleaner
  // would be exposing phoneNumbers() — for now, just hit OpenPhone direct.
  let numbers: Array<{ id: string; number: string }> = [];
  let listError: string | null = null;
  if (apiKeySet) {
    try {
      const res = await fetch("https://api.openphone.com/v1/phone-numbers", {
        headers: { Authorization: process.env.OPENPHONE_API_KEY!, "Content-Type": "application/json" },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: Array<{ id: string; number: string }>;
        message?: string;
      };
      if (!res.ok) {
        listError = `OpenPhone ${res.status}: ${json.message ?? res.statusText}`;
      } else {
        numbers = json.data ?? [];
      }
    } catch (err) {
      listError = err instanceof Error ? err.message : String(err);
    }
  }

  const pinnedNumber = phoneNumberId
    ? numbers.find((n) => n.id === phoneNumberId) ?? null
    : null;

  return NextResponse.json({
    ok: true,
    env: {
      OPENPHONE_API_KEY: apiKeySet ? "(set)" : "(not set)",
      OPENPHONE_PHONE_NUMBER_ID: phoneNumberId ?? "(not set)",
    },
    adapter: adapter ? "real" : "stub",
    account_numbers: numbers.map((n) => ({ id: n.id, number: n.number })),
    list_error: listError,
    pinned_number: pinnedNumber,
    pinned_number_resolves: phoneNumberId ? !!pinnedNumber : "(no pin set — would fall back to numbers[0])",
    fallback_first_number: numbers[0] ?? null,
  });
}

export async function POST(req: NextRequest) {
  const blocked = blockedInProd();
  if (blocked) return blocked;

  let body: { phone?: string; body?: string };
  try {
    body = (await req.json()) as { phone?: string; body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const phone = body.phone ?? "";
  const text = body.body ?? "Test from /api/_debug/openphone";
  const normalized = normalizePhone(phone);

  const adapter = getOpenPhoneAdapter();
  const result = await adapter.sendMessage(phone, text);

  return NextResponse.json({
    ok: true,
    input: { phone, normalized, body: text },
    env: {
      OPENPHONE_API_KEY: process.env.OPENPHONE_API_KEY ? "(set)" : "(not set)",
      OPENPHONE_PHONE_NUMBER_ID: process.env.OPENPHONE_PHONE_NUMBER_ID ?? "(not set)",
    },
    send_result: result,
  });
}
