import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Phase 2 — Poptin lead webhook.
 *
 * Poptin (the form widget on roseconcrete.com) fires a webhook here on every
 * form submission. The payload shape depends on the Poptin form but typically
 * includes name, email, phone, message. We store the raw payload in `leads`,
 * optionally create a draft client, and revalidate the dashboard.
 *
 * Authentication: Poptin doesn't sign webhooks, so we use a simple secret
 * query param. Set POPTIN_WEBHOOK_SECRET in env.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.POPTIN_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Extract common fields. Poptin forms vary — be generous.
  const name =
    asString(body.name) ||
    asString(body.full_name) ||
    [asString(body.first_name), asString(body.last_name)]
      .filter(Boolean)
      .join(" ") ||
    null;
  const email = asString(body.email) || null;
  const phone = asString(body.phone) || asString(body.phone_number) || null;
  const message = asString(body.message) || asString(body.comments) || null;

  // Write the lead.
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      source: "poptin",
      raw_payload: body,
      status: "new",
      notes: message,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[poptin webhook] insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If we have enough info, create a draft client and link it.
  if (name) {
    const { data: client } = await supabase
      .from("clients")
      .insert({
        name,
        email,
        phone,
        source: "poptin",
        notes: message ? `Poptin: ${message}` : "Poptin form submission",
      })
      .select("id")
      .single();

    if (client) {
      await supabase
        .from("leads")
        .update({ client_id: client.id, status: "contacted" })
        .eq("id", lead.id);
    }
  }

  // TODO Phase 2: draft a follow-up email via Gmail MCP using the
  // rose-concrete-email-drafter skill's voice/tone.

  return NextResponse.json({ ok: true, leadId: lead.id });
}

function asString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}
