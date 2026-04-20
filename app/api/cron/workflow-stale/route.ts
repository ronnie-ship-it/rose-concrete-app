import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stepIsStale, type ProjectWorkflowStep } from "@/lib/workflows";

/**
 * Daily cron — flags any workflow step that has been pending /
 * in_progress for more than 3 business days without completing and
 * writes a `workflow_stale_reminders` row so the dashboard shows it.
 *
 * Today the "reminder" is just the dashboard badge (already rendered
 * from `stepIsStale`). When Gmail/OpenPhone adapters land, this worker
 * can also DM the assignee.
 *
 * Idempotent: unique(step_id, business_days) on the ledger table means
 * re-running within the same threshold window is a no-op.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STALE_THRESHOLD_DAYS = 3;

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

  const { data: steps, error } = await supabase
    .from("project_workflow_steps")
    .select("*")
    .in("status", ["pending", "in_progress"])
    .not("in_progress_since", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const staleRows = (steps as ProjectWorkflowStep[]).filter((s) =>
    stepIsStale(s, STALE_THRESHOLD_DAYS, now)
  );

  if (staleRows.length === 0) {
    return NextResponse.json({ checked: steps?.length ?? 0, stale: 0 });
  }

  const inserts = staleRows.map((s) => ({
    step_id: s.id,
    business_days: STALE_THRESHOLD_DAYS,
    channel: "dashboard",
  }));
  // upsert ignores duplicates via the unique(step_id, business_days) idx.
  const { error: insErr } = await supabase
    .from("workflow_stale_reminders")
    .upsert(inserts, { onConflict: "step_id,business_days", ignoreDuplicates: true });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    checked: steps?.length ?? 0,
    stale: staleRows.length,
  });
}
