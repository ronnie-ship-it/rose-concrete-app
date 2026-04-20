import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createLead } from "@/lib/leads";

/**
 * Public lead-capture webhook.
 *
 * Any website (Duda / WordPress / Wix / embedded JS) POSTs a contact form
 * here. This route is a thin HTTP wrapper around `createLead()` — the
 * real side-effects (client upsert, project seeding, draft quote, task
 * creation, notification fan-out, instant SMS + email) live in the shared
 * helper so this webhook, the /book server action, and the OpenPhone
 * unknown-number cron all behave identically.
 *
 * Security: `x-rose-secret` header must match `LEAD_WEBHOOK_SECRET`.
 * Feature-flag gated by `lead_webhook` so Ronnie can park it instantly
 * if the site starts getting spammed.
 */

type LeadBody = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  service_type?: string;
  message?: string;
  source?: string;
  external_id?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-rose-secret");
  const expected = process.env.LEAD_WEBHOOK_SECRET;
  if (!expected) {
    return json({ ok: false, error: "LEAD_WEBHOOK_SECRET not configured" }, 500);
  }
  if (!secret || secret !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const supabase = createServiceRoleClient();

  // Feature flag gate.
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "lead_webhook")
    .single();
  if (!flag?.enabled) {
    return json({ ok: false, error: "Lead webhook disabled" }, 503);
  }

  const result = await createLead({
    source: (body.source ?? "web_webhook").trim().slice(0, 64),
    external_id: body.external_id ?? null,
    name: body.name ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    postal_code: body.postal_code ?? null,
    service_type: body.service_type ?? null,
    message: body.message ?? null,
    raw_payload: body as unknown as Record<string, unknown>,
  });

  if (!result.ok) {
    // createLead surfaces validation failures as plain English ("Need at
    // least one of name, phone, email."). Anything else is a server error.
    const validate = /at least|name|phone|email/i.test(result.error);
    return json({ ok: false, error: result.error }, validate ? 400 : 500);
  }

  if (result.duplicate) {
    return json({ ok: true, duplicate: true, lead_id: result.lead_id });
  }

  return json({
    ok: true,
    lead_id: result.lead_id,
    client_id: result.client_id,
    project_id: result.project_id,
    quote_id: result.quote_id,
    responded: result.responded,
  });
}

export async function GET() {
  return json({ ok: true, service: "rose-concrete lead webhook" });
}
