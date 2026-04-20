import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

/**
 * Crew photo-upload reminders. Two fires per day:
 *
 *   4pm PT — "Hey <name>, please upload today's photos for <project>."
 *   6pm PT — SECOND reminder, ONLY to crew who still have zero uploads
 *            since the 4pm fire. Skips anyone who started uploading.
 *
 * This cron is invoked every hour from Vercel (see vercel.json). It
 * self-gates on the Pacific hour so a stuck deploy / retries can't
 * cause a double-fire at the same time-of-day.
 *
 * Writes one `crew_photo_reminders` row per fire so the project
 * page can render compliance and we can see which crew members
 * needed the second nudge.
 */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    // Allow the Vercel cron scheduler's signature header too.
    request.headers.get("x-vercel-cron") !== "1"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tz gate — fire at 16 or 18 Pacific. First fire prompts, second
  // fire only nags crew who still have zero uploads.
  const force = request.nextUrl.searchParams.get("run") === "1";
  const ptHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  const isFirstRun = ptHour === 16;
  const isSecondRun = ptHour === 18;
  if (!force && !isFirstRun && !isSecondRun) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `hour=${ptHour} (not 16 or 18)`,
    });
  }
  // `?run=1` without specifying — default to first-run behaviour.
  const runKind: "first" | "second" = isSecondRun ? "second" : "first";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Every active project + its assigned crew.
  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, service_address, location, members:project_crew_members(user_id)",
    )
    .eq("status", "active")
    .is("archived_at", null);

  const projectList = (projects ?? []) as Array<{
    id: string;
    name: string;
    service_address: string | null;
    location: string | null;
    members: Array<{ user_id: string }>;
  }>;

  const crewIds = Array.from(
    new Set(
      projectList.flatMap((p) =>
        (p.members ?? []).map((m) => m.user_id),
      ),
    ),
  );
  if (crewIds.length === 0) {
    return NextResponse.json({ ok: true, no_crew: true });
  }

  const { data: crew } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", crewIds);
  const crewById = new Map(
    (crew ?? []).map((c) => [c.id as string, c as { id: string; full_name: string | null; phone: string | null }]),
  );

  // Today's uploads per (project, user). Used for the compliance
  // denormalization stored on the reminder row + skip-if-already-
  // sent-today logic.
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: todaysAttachments } = await supabase
    .from("attachments")
    .select("entity_id, uploaded_by")
    .eq("entity_type", "project")
    .gte("created_at", `${todayIso}T00:00:00Z`)
    .like("mime_type", "image/%");

  const uploadsKey = (pid: string, uid: string) => `${pid}::${uid}`;
  const uploadsByKey = new Map<string, number>();
  for (const r of todaysAttachments ?? []) {
    const k = uploadsKey(r.entity_id as string, r.uploaded_by as string);
    uploadsByKey.set(k, (uploadsByKey.get(k) ?? 0) + 1);
  }

  // Already-sent map per fire. On the first (4pm) run we skip anyone
  // already stamped with sent_at >= today. On the second (6pm) run
  // we look for rows stamped today's 6pm hour to avoid double-firing
  // on retry, and ALSO skip anyone whose uploads_at_send is currently
  // > 0 (they're actively uploading, no second nag needed).
  const { data: alreadySent } = await supabase
    .from("crew_photo_reminders")
    .select("project_id, user_id, sent_at")
    .gte("sent_at", `${todayIso}T00:00:00Z`);
  const allTodaysReminders = (alreadySent ?? []) as Array<{
    project_id: string;
    user_id: string;
    sent_at: string;
  }>;
  // For the first run: any reminder today means skip.
  const firstRunSkipKey = new Set(
    allTodaysReminders.map((r) => `${r.project_id}::${r.user_id}`),
  );
  // For the second run: only skip if a reminder fired between 17:30-
  // 18:30 PT already (prevents retry dupes within the same window).
  // We also skip anyone whose first-run reminder saw them with uploads
  // — they're already compliant, no need to re-nag.
  const secondRunSkipKey = new Set<string>();
  for (const r of allTodaysReminders) {
    const hourPT = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        hour12: false,
      }).format(new Date(r.sent_at)),
    );
    if (hourPT >= 17 && hourPT <= 19) {
      secondRunSkipKey.add(`${r.project_id}::${r.user_id}`);
    }
  }

  const adapter = getOpenPhoneAdapter();
  const results: Array<{
    project_id: string;
    user_id: string;
    ok: boolean;
    uploads: number;
    error?: string;
  }> = [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const project of projectList) {
    const address = project.service_address ?? project.location ?? "";
    for (const m of project.members ?? []) {
      const uid = m.user_id;
      const skipKey = uploadsKey(project.id, uid);
      if (runKind === "first" && firstRunSkipKey.has(skipKey)) continue;
      if (runKind === "second") {
        // Skip if already-sent in the 6pm window.
        if (secondRunSkipKey.has(skipKey)) continue;
        // Second-run nag is ONLY for crew who haven't uploaded yet.
        const uploadsNow = uploadsByKey.get(skipKey) ?? 0;
        if (uploadsNow > 0) continue;
      }

      const crewMember = crewById.get(uid);
      if (!crewMember?.phone) continue;
      const phone = normalizePhone(crewMember.phone);
      if (!phone) continue;
      const first = (crewMember.full_name ?? "").split(/\s+/)[0] || "team";
      const uploads = uploadsByKey.get(skipKey) ?? 0;

      // Per-run body:
      //   first  — friendly nudge, tap-here link
      //   second — firmer, includes address so they can't miss it
      const uploadLink = `${appUrl}/crew/upload?project_id=${project.id}`;
      const body =
        runKind === "first"
          ? uploads === 0
            ? `Hey ${first} — please upload your photos for today on ${project.name}${address ? ` at ${address}` : ""}. Tap here: ${uploadLink}`
            : `Hey ${first} — thanks for the ${uploads} photo${uploads === 1 ? "" : "s"} from ${project.name}. Make sure the rest are up before EOD.`
          : // second run: firmer, only fires when uploads===0
            `Hey ${first} — still no photos from ${project.name}${address ? ` (${address})` : ""} today. Please upload before heading home so the office isn't chasing you tomorrow: ${uploadLink}`;

      const res = await adapter.sendMessage(phone, body);
      await supabase.from("crew_photo_reminders").insert({
        project_id: project.id,
        user_id: uid,
        uploads_at_send: uploads,
        channel: "sms",
        message_id: res.ok ? (res.external_id ?? null) : null,
      });
      results.push({
        project_id: project.id,
        user_id: uid,
        ok: res.ok,
        uploads,
        error: res.ok ? undefined : res.error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    run: runKind,
    projects: projectList.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
