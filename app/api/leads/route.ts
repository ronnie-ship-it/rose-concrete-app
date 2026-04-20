import { NextResponse, type NextRequest } from "next/server";
import { createLead } from "@/lib/leads";
import { SERVICE_TYPES } from "@/lib/service-types";

/**
 * Same-origin lead-capture endpoint for the marketing site.
 *
 * Called from the lead form on every page (hero + footer) on the apex
 * domain. Because it's same-origin and behind the marketing host, we
 * don't require the `x-rose-secret` header that gates /api/public/lead
 * (which exists for cross-origin webhook callers like Poptin / Duda /
 * legacy WordPress).
 *
 * Body shape — all optional except phone OR email:
 *   {
 *     name?:         string,
 *     phone?:        string,
 *     email?:        string,
 *     zip?:          string,   // postal_code in DB
 *     service_type?: string,   // see lib/service-types.ts SERVICE_TYPES
 *     message?:      string,   // free-form description
 *     source?:       string,   // page slug ("/landing/safe-sidewalks-program-san-diego")
 *   }
 *
 * Response shape:
 *   { ok: true,  lead_id, duplicate?: true, responded?: { sms, email, owner_email } }
 *   { ok: false, error }
 *
 * Anti-spam: leans on `createLead`'s built-in (source, phone, 1h)
 * dedupe so a frantic double-click can't double-fire the SMS or
 * spawn two follow-up tasks. We also reject anything that looks like
 * obvious garbage (no name AND no phone AND no email).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  zip?: unknown;
  postal_code?: unknown;
  address?: unknown;
  city?: unknown;
  service_type?: unknown;
  message?: unknown;
  source?: unknown;
  /** Optional honeypot field — any non-empty value is treated as a bot. */
  website?: unknown;
};

function asStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Honeypot — if a hidden `website` field arrives populated, it's a bot.
  // Silently 200 so they don't learn anything from the response.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, lead_id: "honeypot" });
  }

  const name = asStr(body.name);
  const phone = asStr(body.phone);
  const email = asStr(body.email);
  if (!name && !phone && !email) {
    return NextResponse.json(
      { ok: false, error: "Please tell us your name and a phone or email." },
      { status: 400 },
    );
  }

  // Accept either `zip` (form field) or `postal_code` (canonical), prefer zip.
  const postalCode = asStr(body.zip) ?? asStr(body.postal_code);

  // `source` should be the page slug the form was submitted from. Prefix
  // "marketing/" defensively so reports can distinguish marketing-site
  // leads from the legacy webhook ("duda", "poptin", …).
  const rawSource = (asStr(body.source) ?? "unknown").replace(/^\/+/, "").slice(0, 120);
  const source = rawSource.startsWith("marketing/")
    ? rawSource
    : `marketing/${rawSource}`;

  const result = await createLead({
    source,
    name,
    phone,
    email,
    address: asStr(body.address),
    city: asStr(body.city),
    state: "CA",
    postal_code: postalCode,
    // The form dropdown's value attribute is always a canonical enum string
    // (lib/service-types.ts SERVICE_TYPES). Anything else falls to null
    // inside createLead via isServiceType.
    service_type: asStr(body.service_type),
    message: asStr(body.message),
    raw_payload: {
      ...(body as Record<string, unknown>),
      ua: req.headers.get("user-agent") ?? null,
    },
  });

  if (!result.ok) {
    console.error("[/api/leads] createLead failed:", result.error);
    // Don't echo the underlying error to the public — it can leak schema
    // shape. Validate-step errors ARE safe ("Need a name + phone/email").
    const validate = /at least|name|phone|email/i.test(result.error);
    return NextResponse.json(
      {
        ok: false,
        error: validate
          ? result.error
          : "Something went wrong on our end. Please call (619) 537-9408.",
      },
      { status: validate ? 400 : 500 },
    );
  }

  if (result.duplicate) {
    return NextResponse.json({
      ok: true,
      lead_id: result.lead_id,
      duplicate: true,
    });
  }

  return NextResponse.json({
    ok: true,
    lead_id: result.lead_id,
    duplicate: false,
    responded: result.responded,
  });
}

export async function GET() {
  // Smoke-test endpoint — `curl /api/leads` should return a 200 so health
  // checks and Vercel preview validation can verify the route is mounted.
  return NextResponse.json({
    ok: true,
    service: "rose-concrete marketing-site lead intake",
    accepted_service_types: SERVICE_TYPES,
  });
}
