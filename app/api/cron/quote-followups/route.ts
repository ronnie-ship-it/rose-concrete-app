import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

/**
 * Quote follow-up cron — daily at 4pm local (set in vercel.json).
 *
 * For each quote in status='sent' (or 'draft' that was sent via sent_at):
 *   - T+N₁ days: friendly nudge                   (stage quote_followup_1)
 *   - T+N₂ days: second, shorter nudge            (stage quote_followup_2)
 *   - T+N₃ days: mark the quote's project lead as cold (stage quote_cold)
 *
 * N₁ / N₂ / N₃ come from public.automation_config (defaults 3/7/14).
 * Idempotency via `automation_runs` unique (stage, entity_type, entity_id).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const { data: cfg } = await supabase
    .from("automation_config")
    .select(
      "quote_followup_first_days, quote_followup_second_days, quote_cold_after_days"
    )
    .limit(1)
    .maybeSingle();
  const firstDays = cfg?.quote_followup_first_days ?? 3;
  const secondDays = cfg?.quote_followup_second_days ?? 7;
  const coldDays = cfg?.quote_cold_after_days ?? 14;

  // Open quotes = sent-but-not-accepted.
  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "id, number, status, issued_at, project:projects(client_id, client:clients(id, name, phone))"
    )
    .in("status", ["sent", "draft"])
    .order("issued_at", { ascending: true });

  const now = Date.now();
  const adapter = getOpenPhoneAdapter();
  const results: Array<Record<string, unknown>> = [];

  for (const q of quotes ?? []) {
    const proj = Array.isArray(q.project) ? q.project[0] : q.project;
    if (!proj) continue;
    const client = Array.isArray(proj.client) ? proj.client[0] : proj.client;
    if (!client) continue;

    const ageDays =
      (now - new Date(q.issued_at).getTime()) / (1000 * 60 * 60 * 24);

    const stages: Array<{
      stage: "quote_followup_1" | "quote_followup_2" | "quote_cold";
      needsSms: boolean;
      body?: string;
    }> = [];
    if (ageDays >= firstDays && ageDays < secondDays) {
      stages.push({
        stage: "quote_followup_1",
        needsSms: true,
        body: `Hi ${firstName(
          client.name
        )} — Rose Concrete here. Just checking in on quote #${q.number}. Any questions? Reply here and I'll jump on it.`,
      });
    }
    if (ageDays >= secondDays && ageDays < coldDays) {
      stages.push({
        stage: "quote_followup_2",
        needsSms: true,
        body: `Hi ${firstName(
          client.name
        )} — still happy to answer questions on quote #${q.number}. If the timing isn't right just let me know and I'll stop bugging you.`,
      });
    }
    if (ageDays >= coldDays) {
      stages.push({ stage: "quote_cold", needsSms: false });
    }

    for (const s of stages) {
      // Already sent?
      const { data: prior } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("stage", s.stage)
        .eq("entity_type", "quote")
        .eq("entity_id", q.id)
        .maybeSingle();
      if (prior) continue;

      if (s.needsSms && s.body) {
        const phone = normalizePhone(client.phone);
        if (!phone) {
          await supabase.from("automation_runs").insert({
            stage: s.stage,
            entity_type: "quote",
            entity_id: q.id,
            channel: "sms",
            status: "skipped",
            error: "No phone on file",
          });
          results.push({ q: q.id, stage: s.stage, skipped: "no_phone" });
          continue;
        }
        const send = await adapter.sendMessage(phone, s.body);
        await supabase.from("automation_runs").insert({
          stage: s.stage,
          entity_type: "quote",
          entity_id: q.id,
          channel: "sms",
          status: send.ok ? "sent" : "failed",
          error: send.ok ? null : send.error,
        });
        if (send.ok) {
          await supabase.from("communications").insert({
            client_id: client.id,
            direction: "outbound",
            channel: "sms",
            phone_number: phone,
            started_at: new Date().toISOString(),
            body: s.body,
            external_id: send.external_id,
          });
        }
        results.push({ q: q.id, stage: s.stage, sent: send.ok });
      } else if (s.stage === "quote_cold") {
        // Mark the quote as expired + log stage.
        await supabase
          .from("quotes")
          .update({ status: "expired" })
          .eq("id", q.id);
        await supabase.from("automation_runs").insert({
          stage: "quote_cold",
          entity_type: "quote",
          entity_id: q.id,
          channel: "system",
          status: "sent",
        });
        results.push({ q: q.id, stage: "quote_cold", marked: true });
      }
    }
  }

  console.log(`[quote-followups] processed=${results.length}`);
  return NextResponse.json({ ok: true, results });
}

function firstName(name: string): string {
  return (name || "").split(/\s+/)[0] || "there";
}
