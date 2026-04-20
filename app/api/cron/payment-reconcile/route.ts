import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  reconcileMilestones,
  createStubQboAdapter,
  createQboApiAdapter,
  type MilestoneForReconcile,
  type QboAdapter,
} from "@/lib/qbo/reconcile";

/**
 * Nightly reconcile: walk every unpaid milestone whose schedule has a QBO
 * invoice id, ask QBO "is this paid?" via the adapter, and if so flip
 * status → paid + set receipt_pending=true (so BACKLOG #3's receipt
 * worker picks it up on its next tick).
 *
 * Gated by the `payment_schedules` feature flag — skips cleanly if off.
 *
 * Add to vercel.json: { "path": "/api/cron/payment-reconcile",
 *                        "schedule": "0 14 * * *" }   // 7 AM Pacific
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Flag check — kept cheap, one query.
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "payment_schedules")
    .maybeSingle();
  if (!flag?.enabled) {
    return NextResponse.json({
      ok: true,
      skipped: "payment_schedules flag disabled",
    });
  }

  // Fetch unpaid milestones joined with their schedule's QBO invoice id.
  const { data: rows, error } = await supabase
    .from("payment_milestones")
    .select(
      "id, amount, status, qbo_payment_id, schedule:payment_schedules!inner(qbo_invoice_id)"
    )
    .not("status", "in", '("paid","waived","refunded")');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const milestones: MilestoneForReconcile[] = (rows ?? []).map((r) => {
    const schedule = Array.isArray(r.schedule) ? r.schedule[0] : r.schedule;
    return {
      id: r.id as string,
      amount: Number(r.amount),
      status: r.status as string,
      qbo_payment_id: (r.qbo_payment_id as string | null) ?? null,
      schedule_qbo_invoice_id:
        (schedule?.qbo_invoice_id as string | null) ?? null,
    };
  });

  const adapter = pickAdapter();
  const result = await reconcileMilestones(milestones, adapter);

  // Apply updates sequentially — small batch, no parallelism needed.
  const applied: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const u of result.updates) {
    const { error: upErr } = await supabase
      .from("payment_milestones")
      .update({
        status: u.status,
        qbo_payment_id: u.qbo_payment_id,
        qbo_paid_amount: u.qbo_paid_amount,
        qbo_paid_at: u.qbo_paid_at,
        receipt_pending: u.receipt_pending,
      })
      .eq("id", u.milestone_id);
    if (upErr) {
      failed.push({ id: u.milestone_id, error: upErr.message });
    } else {
      applied.push(u.milestone_id);
    }
  }

  return NextResponse.json({
    ok: true,
    adapter: adapterMode(),
    checked: result.checked,
    skipped_no_invoice: result.skipped_no_invoice,
    skipped_already_paid: result.skipped_already_paid,
    applied: applied.length,
    failed,
  });
}

function adapterMode(): "stub" | "api" {
  return process.env.QBO_ACCESS_TOKEN && process.env.QBO_REALM_ID
    ? "api"
    : "stub";
}

function pickAdapter(): QboAdapter {
  if (adapterMode() === "api") {
    return createQboApiAdapter({
      realm_id: process.env.QBO_REALM_ID!,
      access_token: process.env.QBO_ACCESS_TOKEN!,
    });
  }
  return createStubQboAdapter();
}
