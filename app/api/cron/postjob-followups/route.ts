import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

/**
 * Post-job follow-ups — daily at 5pm local. For each project with
 * status='done' and completed_at set:
 *   - +N days: thank-you SMS                        (postjob_thankyou)
 *   - +M days: Google-review request (with link)    (postjob_review)
 *   - +K days: check-in "anything else you need?"   (postjob_checkin)
 *
 * N/M/K + review_url come from automation_config. Idempotent via
 * automation_runs.
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
      "postjob_thankyou_days, postjob_review_days, postjob_checkin_days, review_url"
    )
    .limit(1)
    .maybeSingle();
  const thankDays = cfg?.postjob_thankyou_days ?? 0;
  const reviewDays = cfg?.postjob_review_days ?? 3;
  const checkinDays = cfg?.postjob_checkin_days ?? 30;
  const reviewUrl = cfg?.review_url ?? null;

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, completed_at, status, client:clients(id, name, phone)"
    )
    .eq("status", "done")
    .not("completed_at", "is", null);

  const adapter = getOpenPhoneAdapter();
  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  for (const p of projects ?? []) {
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    if (!client || !p.completed_at) continue;
    const ageDays =
      (now - new Date(p.completed_at).getTime()) / (1000 * 60 * 60 * 24);

    const stages: Array<{
      stage: "postjob_thankyou" | "postjob_review" | "postjob_checkin";
      threshold: number;
      body: string;
    }> = [];
    const fn = (client.name || "").split(/\s+/)[0] || "there";
    if (ageDays >= thankDays && ageDays < reviewDays) {
      stages.push({
        stage: "postjob_thankyou",
        threshold: thankDays,
        body: `Hi ${fn} — Rose Concrete here. Thanks for letting us pour for you. Any issues at all, reply to this text and we'll be back out. — Ronnie`,
      });
    }
    if (ageDays >= reviewDays && ageDays < checkinDays) {
      stages.push({
        stage: "postjob_review",
        threshold: reviewDays,
        body:
          `Hi ${fn} — hope the concrete's looking great. If you've got a minute, a quick Google review goes a long way for a small business like ours.` +
          (reviewUrl ? ` ${reviewUrl}` : ""),
      });
    }
    if (ageDays >= checkinDays) {
      stages.push({
        stage: "postjob_checkin",
        threshold: checkinDays,
        body: `Hi ${fn} — checking in a month out from our pour. Anything else you've been thinking about? Happy to quote it.`,
      });
    }

    for (const s of stages) {
      const { data: prior } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("stage", s.stage)
        .eq("entity_type", "project")
        .eq("entity_id", p.id)
        .maybeSingle();
      if (prior) continue;

      const phone = normalizePhone(client.phone);
      if (!phone) {
        await supabase.from("automation_runs").insert({
          stage: s.stage,
          entity_type: "project",
          entity_id: p.id,
          channel: "sms",
          status: "skipped",
          error: "No phone on file",
        });
        continue;
      }
      const send = await adapter.sendMessage(phone, s.body);
      await supabase.from("automation_runs").insert({
        stage: s.stage,
        entity_type: "project",
        entity_id: p.id,
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
      results.push({ p: p.id, stage: s.stage, sent: send.ok });
    }
  }

  console.log(`[postjob-followups] processed=${results.length}`);
  return NextResponse.json({ ok: true, results });
}
