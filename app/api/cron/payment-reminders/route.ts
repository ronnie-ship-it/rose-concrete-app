import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createDefaultSenders,
  buildReminderCopy,
  buildSmsCopy,
  type ReminderContext,
  type ReminderSenders,
} from "@/lib/reminder-senders";

/**
 * Daily payment-reminder worker.
 *
 * Picks every `payment_reminders` row that:
 *   - status = 'scheduled'
 *   - scheduled_for <= now()
 *   - parent milestone isn't paid/waived/refunded
 *   - parent milestone isn't paused (reminders_paused=false)
 *
 * Sends via the Gmail MCP (email) and OpenPhone MCP (sms) adapters. Until
 * those are wired, the stub adapter returns `skip: true` and we mark the
 * row 'skipped' (not 'failed', to avoid alerting noise).
 *
 * Idempotent: the unique index on (milestone_id, channel, offset_days)
 * prevents duplicate rows in the first place, and we only send rows with
 * status='scheduled' so re-running the cron is safe.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://app.roseconcrete.com";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "payment_reminders")
    .maybeSingle();
  if (!flag?.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: "payment_reminders flag disabled",
    });
  }

  // Fetch all due reminders with enough context to send. Join through the
  // milestone → schedule → project → client so the adapter has everything.
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("payment_reminders")
    .select(
      `id, channel, offset_days, scheduled_for, status,
       milestone:payment_milestones!inner(
         id, label, amount, due_date, status, pay_token, reminders_paused,
         schedule:payment_schedules!inner(
           project:projects!inner(
             name,
             client:clients(name, email, phone)
           )
         )
       )`
    )
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const senders: ReminderSenders = createDefaultSenders();
  const summary = { sent: 0, skipped: 0, failed: 0, ignored: 0 };

  for (const row of rows ?? []) {
    const milestone = Array.isArray(row.milestone)
      ? row.milestone[0]
      : row.milestone;
    if (!milestone) {
      summary.ignored++;
      continue;
    }
    if (
      milestone.reminders_paused ||
      ["paid", "waived", "refunded"].includes(milestone.status)
    ) {
      summary.ignored++;
      continue;
    }

    const schedule = Array.isArray(milestone.schedule)
      ? milestone.schedule[0]
      : milestone.schedule;
    const project = schedule?.project
      ? Array.isArray(schedule.project)
        ? schedule.project[0]
        : schedule.project
      : null;
    const client = project?.client
      ? Array.isArray(project.client)
        ? project.client[0]
        : project.client
      : null;

    if (!project) {
      summary.ignored++;
      continue;
    }

    const ctx: ReminderContext = {
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      client_phone: client?.phone ?? null,
      project_name: project.name,
      milestone_label: milestone.label,
      amount: Number(milestone.amount),
      due_date: milestone.due_date ?? null,
      pay_url: `${APP_BASE_URL}/pay/${milestone.pay_token}`,
      offset_days: row.offset_days,
    };

    // Skip if we have no destination.
    if (row.channel === "email" && !ctx.client_email) {
      await supabase
        .from("payment_reminders")
        .update({ status: "skipped", error: "no client email on file" })
        .eq("id", row.id);
      summary.skipped++;
      continue;
    }
    if (row.channel === "sms" && !ctx.client_phone) {
      await supabase
        .from("payment_reminders")
        .update({ status: "skipped", error: "no client phone on file" })
        .eq("id", row.id);
      summary.skipped++;
      continue;
    }

    // Compute copy (not used by stubs, but exercises the builder + keeps
    // the types honest for when real senders land).
    if (row.channel === "email") {
      void buildReminderCopy(ctx);
    } else {
      void buildSmsCopy(ctx);
    }

    const result =
      row.channel === "email"
        ? await senders.sendEmail(ctx)
        : await senders.sendSms(ctx);

    if (result.ok) {
      await supabase
        .from("payment_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: result.message_id,
        })
        .eq("id", row.id);
      summary.sent++;
    } else if (result.skip) {
      await supabase
        .from("payment_reminders")
        .update({ status: "skipped", error: result.error })
        .eq("id", row.id);
      summary.skipped++;
    } else {
      await supabase
        .from("payment_reminders")
        .update({ status: "failed", error: result.error })
        .eq("id", row.id);
      summary.failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    adapter: "stub",
    processed: rows?.length ?? 0,
    ...summary,
  });
}

