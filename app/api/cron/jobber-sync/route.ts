import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { syncJobberSchedule } from "@/lib/jobber-sync";

/**
 * Cron: pull the Jobber schedule into the app every 15 minutes.
 * Crew-rebuild phase 1 — see docs/crew-app-rebuild-brief.md.
 *
 * Also callable manually (Bearer CRON_SECRET) and reused by the crew
 * pull-to-refresh action in phase 2 via `syncJobberSchedule()` directly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceRoleClient();
  const summary = await syncJobberSchedule(supabase);
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
