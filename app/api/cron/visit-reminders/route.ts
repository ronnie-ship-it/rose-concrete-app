import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";
import { createDefaultSenders } from "@/lib/reminder-senders";

/**
 * Every 15 min, scan scheduled visits and fire a 24h / 1h reminder text
 * (and email) to the client. Idempotent via unique(visit_id, offset_hours,
 * channel) on `visit_reminders`.
 *
 * Feature-flag gated by `visit_reminders`. Adapter is stubbed — same
 * Gmail/OpenPhone senders the payment-reminder cron uses.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOWS: { offset_hours: number; lead_min: number; late_min: number }[] = [
  // visit starts ~24h from now → fire once when within the 24h ± 7.5min slot
  { offset_hours: -24, lead_min: 24 * 60 - 8, late_min: 24 * 60 + 8 },
  { offset_hours: -1, lead_min: 60 - 8, late_min: 60 + 8 },
];

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
    .eq("key", "visit_reminders")
    .maybeSingle();
  if (!flag?.enabled) {
    return NextResponse.json({ ok: true, skipped: "flag_off" });
  }

  const senders = createDefaultSenders();
  const now = Date.now();
  const summary = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const w of WINDOWS) {
    const fromIso = new Date(now + w.lead_min * 60_000).toISOString();
    const toIso = new Date(now + w.late_min * 60_000).toISOString();

    const { data: visits } = await supabase
      .from("visits")
      .select(
        `id, scheduled_for, notes,
         project:projects!inner(
           name, location,
           client:clients(name, email, phone)
         )`
      )
      .eq("status", "scheduled")
      .gte("scheduled_for", fromIso)
      .lte("scheduled_for", toIso)
      .limit(100);

    for (const v of visits ?? []) {
      summary.processed++;
      const project = Array.isArray(v.project) ? v.project[0] : v.project;
      const client = project?.client
        ? Array.isArray(project.client)
          ? project.client[0]
          : project.client
        : null;
      if (!project) continue;

      for (const channel of ["email", "sms"] as const) {
        const dest = channel === "email" ? client?.email : client?.phone;
        if (!dest) continue;

        // Short-circuit if we've already logged this one.
        const { data: existing } = await supabase
          .from("visit_reminders")
          .select("id")
          .eq("visit_id", v.id)
          .eq("offset_hours", w.offset_hours)
          .eq("channel", channel)
          .maybeSingle();
        if (existing) continue;

        const ctx = {
          client_name: client?.name ?? null,
          client_email: client?.email ?? null,
          client_phone: client?.phone ?? null,
          project_name: project.name,
          milestone_label:
            w.offset_hours === -24
              ? `your appointment tomorrow`
              : `your appointment in 1 hour`,
          amount: 0,
          due_date: v.scheduled_for,
          pay_url: project.location ?? "",
          offset_days: w.offset_hours,
        };

        const res =
          channel === "email"
            ? await senders.sendEmail(ctx)
            : await senders.sendSms(ctx);

        const status = res.ok ? "sent" : res.skip ? "skipped" : "failed";
        await supabase.from("visit_reminders").insert({
          visit_id: v.id,
          offset_hours: w.offset_hours,
          channel,
          status,
          error: res.ok ? null : res.error,
        });
        summary[status]++;
      }
    }
  }

  return NextResponse.json({ ok: true, adapter: "stub", ...summary });
}
