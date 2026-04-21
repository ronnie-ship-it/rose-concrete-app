import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";
import { createDefaultSenders } from "@/lib/reminder-senders";
import { GOOGLE_REVIEW_URL } from "@/lib/marketing/brand";

/**
 * Daily Google-review-request worker.
 *
 * Step 1 — seed: for every milestone that's paid + receipted and doesn't
 * yet have a `review_requests` row, insert one with send_after = paid_at + 3d.
 *
 * Step 2 — send: pick every pending `review_requests` row with
 * send_after <= now and fire the email/SMS via the shared stub adapter.
 *
 * Feature-flag gated by `review_request_auto_send`. Google review URL
 * comes from `feature_flags.config.google_review_url` for the
 * `review_request_auto_send` row (set via `/dashboard/settings/reviews`),
 * falling back to `GOOGLE_REVIEW_URL` from lib/marketing/brand.ts when
 * the config field is empty — so the cron always has a real destination
 * even on a fresh install with no settings tweaked yet.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled, config")
    .eq("key", "review_request_auto_send")
    .maybeSingle();
  if (!flag?.enabled) {
    return NextResponse.json({ ok: true, skipped: "flag_off" });
  }
  // Settings-overridable, brand-constant default. Trim the override
  // because a stray newline pasted into the form would break the link.
  const overrideUrl = (
    (flag.config as { google_review_url?: string })?.google_review_url ?? ""
  ).trim();
  const reviewUrl = overrideUrl || GOOGLE_REVIEW_URL;

  // 1. Seed new review_requests from paid+receipted milestones.
  const { data: ready } = await supabase
    .from("payment_milestones")
    .select(
      `id, qbo_paid_at,
       schedule:payment_schedules!inner(
         project:projects!inner(
           client_id, name
         )
       )`
    )
    .eq("status", "paid")
    .not("qbo_paid_at", "is", null)
    .limit(200);

  let seeded = 0;
  for (const m of ready ?? []) {
    const { data: existing } = await supabase
      .from("review_requests")
      .select("id")
      .eq("milestone_id", m.id)
      .maybeSingle();
    if (existing) continue;

    const schedule = Array.isArray(m.schedule) ? m.schedule[0] : m.schedule;
    const project = schedule?.project
      ? Array.isArray(schedule.project)
        ? schedule.project[0]
        : schedule.project
      : null;
    if (!project) continue;

    const sendAfter = new Date(
      new Date(m.qbo_paid_at as unknown as string).getTime() +
        3 * 24 * 60 * 60_000
    ).toISOString();

    await supabase.from("review_requests").insert({
      milestone_id: m.id,
      client_id: project.client_id,
      channel: "email",
      status: "pending",
      send_after: sendAfter,
    });
    seeded++;
  }

  // 2. Send everything due now.
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("review_requests")
    .select(
      `id, channel, client_id,
       client:clients(name, email, phone)`
    )
    .eq("status", "pending")
    .lte("send_after", nowIso)
    .limit(100);

  const senders = createDefaultSenders();
  const summary = { seeded, sent: 0, skipped: 0, failed: 0 };

  for (const r of due ?? []) {
    const client = Array.isArray(r.client) ? r.client[0] : r.client;
    const dest = r.channel === "email" ? client?.email : client?.phone;
    if (!dest) {
      await supabase
        .from("review_requests")
        .update({ status: "skipped", error: "no destination on file" })
        .eq("id", r.id);
      summary.skipped++;
      continue;
    }

    const ctx = {
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      client_phone: client?.phone ?? null,
      project_name: "your recent project",
      milestone_label: "leaving us a review",
      amount: 0,
      due_date: null,
      pay_url: reviewUrl,
      offset_days: 0,
    };

    const res =
      r.channel === "email"
        ? await senders.sendEmail(ctx)
        : await senders.sendSms(ctx);
    if (res.ok) {
      await supabase
        .from("review_requests")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", r.id);
      summary.sent++;
    } else if (res.skip) {
      await supabase
        .from("review_requests")
        .update({ status: "skipped", error: res.error })
        .eq("id", r.id);
      summary.skipped++;
    } else {
      await supabase
        .from("review_requests")
        .update({ status: "failed", error: res.error })
        .eq("id", r.id);
      summary.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
