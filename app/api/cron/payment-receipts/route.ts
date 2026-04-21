import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";
import { renderReceiptTemplate } from "@/lib/receipt-templates";
import {
  createStubReceiptSender,
  fetchQboReceiptPdf,
  type ReceiptSender,
} from "@/lib/receipt-sender";

/**
 * Receipt worker — runs every 15 minutes. For every milestone with
 * receipt_pending=true, pull the QBO PDF, draft the thank-you email from
 * the template, send via the Gmail adapter, and log the attempt in
 * payment_receipt_sends (unique on milestone_id + qbo_payment_id, so
 * retries are idempotent).
 *
 * On success: receipt_pending cleared, receipt_sent_at stamped, log row
 * set to 'sent'.
 * On skip (adapter not wired): log row 'pending' → will retry next tick;
 * receipt_pending stays true so we don't lose the task.
 * On hard fail: log row 'failed' with error; receipt_pending cleared so
 * we don't hammer the adapter — human-inspect.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    .select("enabled")
    .eq("key", "qbo_receipt_auto_send")
    .maybeSingle();
  if (!flag?.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: "qbo_receipt_auto_send flag disabled",
    });
  }

  const { data: settings } = await supabase
    .from("invoice_settings")
    .select(
      "receipt_sender_email, receipt_subject_template, receipt_body_template"
    )
    .limit(1)
    .maybeSingle();

  // Column may be missing if migration 010 hasn't been applied yet — we
  // fall back to a default sender + the schema's own defaults handle the
  // templates for newly-seeded rows.
  const sender = (settings?.receipt_sender_email as string | undefined) ??
    "ronnie@sandiegoconcrete.ai";
  const subjectTemplate =
    (settings?.receipt_subject_template as string | undefined) ??
    "Receipt for {{milestone_label}} — {{project_name}}";
  const bodyTemplate =
    (settings?.receipt_body_template as string | undefined) ??
    "Hi {{client_name}}, thanks for your payment of {{amount}}.";

  const { data: rows, error } = await supabase
    .from("payment_milestones")
    .select(
      `id, label, amount, qbo_payment_id, qbo_paid_at, status, receipt_pending,
       schedule:payment_schedules!inner(
         project:projects!inner(
           name,
           client:clients(name, email)
         )
       )`
    )
    .eq("receipt_pending", true)
    .eq("status", "paid")
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const receiptSender: ReceiptSender = createStubReceiptSender();
  const summary = { sent: 0, skipped: 0, failed: 0, ignored: 0 };

  for (const m of rows ?? []) {
    const schedule = Array.isArray(m.schedule) ? m.schedule[0] : m.schedule;
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

    if (!project || !client?.email || !m.qbo_payment_id) {
      summary.ignored++;
      continue;
    }

    // Claim the send slot (idempotent via unique(milestone_id, qbo_payment_id)).
    const { data: existing } = await supabase
      .from("payment_receipt_sends")
      .select("id, status")
      .eq("milestone_id", m.id)
      .eq("qbo_payment_id", m.qbo_payment_id)
      .maybeSingle();

    if (existing?.status === "sent") {
      // Already sent; just clean up the pending flag on the milestone.
      await supabase
        .from("payment_milestones")
        .update({ receipt_pending: false, receipt_sent_at: new Date().toISOString() })
        .eq("id", m.id);
      summary.ignored++;
      continue;
    }

    const subject = renderReceiptTemplate(subjectTemplate, {
      client_name: client.name,
      project_name: project.name,
      milestone_label: m.label,
      amount_dollars: Number(m.amount),
      paid_at: (m.qbo_paid_at as string | null) ?? null,
    });
    const body = renderReceiptTemplate(bodyTemplate, {
      client_name: client.name,
      project_name: project.name,
      milestone_label: m.label,
      amount_dollars: Number(m.amount),
      paid_at: (m.qbo_paid_at as string | null) ?? null,
    });

    if (!existing) {
      await supabase.from("payment_receipt_sends").insert({
        milestone_id: m.id,
        qbo_payment_id: m.qbo_payment_id,
        to_email: client.email,
        subject,
        status: "pending",
      });
    }

    const pdf = await fetchQboReceiptPdf(m.qbo_payment_id as string);
    const result = await receiptSender.send({
      to: client.email,
      from: sender,
      subject,
      body,
      pdf_attachment: pdf,
    });

    if (result.ok) {
      await supabase
        .from("payment_receipt_sends")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          gmail_message_id: result.message_id,
        })
        .eq("milestone_id", m.id)
        .eq("qbo_payment_id", m.qbo_payment_id);
      await supabase
        .from("payment_milestones")
        .update({
          receipt_pending: false,
          receipt_sent_at: new Date().toISOString(),
        })
        .eq("id", m.id);
      summary.sent++;
    } else if (result.skip) {
      // Leave pending so next tick retries; don't mark failed.
      summary.skipped++;
    } else {
      await supabase
        .from("payment_receipt_sends")
        .update({ status: "failed", error: result.error })
        .eq("milestone_id", m.id)
        .eq("qbo_payment_id", m.qbo_payment_id);
      await supabase
        .from("payment_milestones")
        .update({ receipt_pending: false })
        .eq("id", m.id);
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
