import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Recurring-jobs cron — daily at 6 AM local. For every project with a
 * `recurrence_cadence` and a `recurrence_next_at` in the past, create
 * the next visit on that project and advance `recurrence_next_at` by
 * the cadence.
 *
 * Cadence → days mapping:
 *   weekly    → 7
 *   biweekly  → 14
 *   monthly   → 30 (simple, good enough for a concrete crew)
 *   quarterly → 90
 *   yearly    → 365
 *   custom    → projects.recurrence_interval_days
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const now = new Date();
  const { data: due, error } = await supabase
    .from("projects")
    .select(
      "id, name, recurrence_cadence, recurrence_interval_days, recurrence_next_at, recurrence_end_at"
    )
    .not("recurrence_cadence", "is", null)
    .lte("recurrence_next_at", now.toISOString());
  if (error) {
    console.error("[recurring-jobs] read failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let created = 0;
  const log: Array<Record<string, unknown>> = [];

  for (const p of due ?? []) {
    if (p.recurrence_end_at && new Date(p.recurrence_end_at) < now) continue;
    const intervalDays =
      p.recurrence_cadence === "custom"
        ? p.recurrence_interval_days ?? 30
        : CADENCE_DAYS[p.recurrence_cadence as string] ?? 30;

    const scheduledFor = new Date(p.recurrence_next_at!);
    const { error: visitErr } = await supabase.from("visits").insert({
      project_id: p.id,
      scheduled_for: scheduledFor.toISOString(),
      duration_min: 120,
      status: "scheduled",
      notes: "Auto-created from recurring schedule",
    });
    if (visitErr) {
      console.error("[recurring-jobs] visit insert failed", visitErr);
      log.push({ p: p.id, error: visitErr.message });
      continue;
    }

    const nextAt = new Date(
      scheduledFor.getTime() + intervalDays * 24 * 60 * 60 * 1000
    );
    await supabase
      .from("projects")
      .update({ recurrence_next_at: nextAt.toISOString() })
      .eq("id", p.id);

    created++;
    log.push({ p: p.id, scheduled_for: scheduledFor.toISOString(), next_at: nextAt.toISOString() });
  }

  console.log(`[recurring-jobs] created=${created}`);
  return NextResponse.json({ ok: true, created, log });
}
