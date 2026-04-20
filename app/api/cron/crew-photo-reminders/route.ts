import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";

/**
 * Daily 4pm crew photo-upload reminder.
 *
 * For every project that's `active` and has at least one crew member
 * assigned, fires an SMS to each crew member via OpenPhone asking them
 * to upload the day's photos. Writes one `crew_photo_reminders` row
 * per (project, user, day) so the project page can render compliance.
 *
 * Cron runs this hourly; we only fire between 16:00 and 16:59 local
 * (San Diego = UTC-7 in April). Using a simple hour check instead of a
 * single-shot cron means we survive retries + time-zone drift without
 * double-firing — the reminders table's unique constraint prevents
 * dupes.
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

  // Tz gate — only fire if it's 4pm Pacific. Skip if the user forced
  // `?run=1` during dev/testing.
  const force = request.nextUrl.searchParams.get("run") === "1";
  const ptHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (!force && ptHour !== 16) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `hour=${ptHour} (not 16)`,
    });
  }

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

  // Skip users we've already reminded today.
  const { data: alreadySent } = await supabase
    .from("crew_photo_reminders")
    .select("project_id, user_id")
    .gte("sent_at", `${todayIso}T00:00:00Z`);
  const alreadySentKey = new Set(
    (alreadySent ?? []).map(
      (r) => `${r.project_id as string}::${r.user_id as string}`,
    ),
  );

  const adapter = getOpenPhoneAdapter();
  const results: Array<{
    project_id: string;
    user_id: string;
    ok: boolean;
    uploads: number;
    error?: string;
  }> = [];

  for (const project of projectList) {
    for (const m of project.members ?? []) {
      const uid = m.user_id;
      if (alreadySentKey.has(uploadsKey(project.id, uid))) continue;
      const crewMember = crewById.get(uid);
      if (!crewMember?.phone) continue;
      const phone = normalizePhone(crewMember.phone);
      if (!phone) continue;
      const first = (crewMember.full_name ?? "").split(/\s+/)[0] || "team";
      const uploads = uploadsByKey.get(uploadsKey(project.id, uid)) ?? 0;
      const body =
        uploads === 0
          ? `Hey ${first} — please upload today's photos from ${project.name} before you head out. Open the crew app: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/crew`
          : `Hey ${first} — thanks for the ${uploads} photo${uploads === 1 ? "" : "s"} from ${project.name}. Make sure the rest are up before EOD.`;
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
    projects: projectList.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
