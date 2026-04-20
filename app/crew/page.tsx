import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { MarkDoneButton } from "./mark-done-button";
import { ClockButton } from "./clock-button";
import { OnMyWayButton } from "./on-my-way-button";
import { markVisitCompleteAction } from "@/app/dashboard/schedule/actions";
import { getLangPref } from "@/lib/preferences";
import { t, tPlural } from "@/lib/i18n";

export const metadata = { title: "Today — Rose Concrete" };

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function mapsHref(address: string): string {
  return `https://www.google.com/maps/?q=${encodeURIComponent(address)}`;
}

export default async function CrewToday() {
  const user = await requireRole(["crew"]);
  const supabase = await createClient();
  const lang = await getLangPref();

  const today = new Date();
  const { data: visits } = await supabase
    .from("visits")
    .select(
      "id, scheduled_for, duration_min, status, notes, project:projects(id, name, location, service_address, client:clients(name, phone))",
    )
    .gte("scheduled_for", startOfDay(today).toISOString())
    .lte("scheduled_for", endOfDay(today).toISOString())
    .order("scheduled_for", { ascending: true });

  const visitIds = (visits ?? []).map((v) => v.id);
  const projectIds = Array.from(
    new Set(
      (visits ?? [])
        .map((v) => {
          const p = Array.isArray(v.project) ? v.project[0] : v.project;
          return p?.id as string | undefined;
        })
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const [{ data: openClocks }, { data: photoRows }] = await Promise.all([
    visitIds.length > 0
      ? supabase
          .from("visit_time_entries")
          .select("visit_id")
          .eq("user_id", user.id)
          .in("visit_id", visitIds)
          .is("clock_out_at", null)
      : Promise.resolve({ data: [] as { visit_id: string }[] }),
    projectIds.length > 0
      ? supabase
          .from("attachments")
          .select("entity_id, mime_type")
          .eq("entity_type", "project")
          .in("entity_id", projectIds)
          .like("mime_type", "image/%")
      : Promise.resolve({ data: [] as { entity_id: string; mime_type: string }[] }),
  ]);
  const openClockByVisit = new Set(
    (openClocks ?? []).map((c) => c.visit_id),
  );
  // Count photos per project (not just "has any") — the mark-done
  // gate now requires PHOTO_MIN = 3, so we need the actual count.
  const photoCountByProject = new Map<string, number>();
  for (const r of photoRows ?? []) {
    const pid = r.entity_id as string;
    photoCountByProject.set(pid, (photoCountByProject.get(pid) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{t(lang, "Today")}</h1>
        <p className="text-xs text-neutral-500">
          {t(lang, "Hey")} {user.full_name ?? user.email.split("@")[0]} —{" "}
          {visits?.length ?? 0}{" "}
          {tPlural(lang, visits?.length ?? 0, "visit", "visits")}{" "}
          {t(lang, "on your plate.")}
        </p>
      </div>

      {!visits || visits.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
          {t(lang, "Nothing scheduled today. Enjoy the breather.")}
        </div>
      ) : (
        <ul className="space-y-3">
          {visits.map((v) => {
            const project = Array.isArray(v.project) ? v.project[0] : v.project;
            const client =
              project &&
              (Array.isArray(project.client) ? project.client[0] : project.client);
            const address = project?.service_address ?? project?.location ?? null;
            const time = new Date(v.scheduled_for).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            const completed = v.status === "completed";
            const action = markVisitCompleteAction.bind(null, v.id);
            const photoCount = project?.id
              ? photoCountByProject.get(project.id) ?? 0
              : 0;
            const hasPhoto = photoCount > 0;
            return (
              <li
                key={v.id}
                className={`rounded-lg border bg-white p-4 shadow-sm ${
                  completed ? "border-green-200 opacity-70" : "border-neutral-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-neutral-900">{time}</p>
                  <span className="text-xs text-neutral-500">
                    {v.duration_min}m
                  </span>
                </div>
                <p className="mt-1 text-base font-semibold text-neutral-900">
                  {project?.name ?? "—"}
                </p>
                {client && (
                  <div className="mt-1 text-xs text-neutral-600">
                    {client.name}
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                      >
                        📞 {t(lang, "Call")}
                      </a>
                    )}
                  </div>
                )}
                {address && (
                  <a
                    href={mapsHref(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs text-neutral-700"
                  >
                    📍 {address}
                  </a>
                )}
                {v.notes && (
                  <p className="mt-2 text-xs text-neutral-700">{v.notes}</p>
                )}
                {!completed && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ClockButton
                      visitId={v.id}
                      isOpen={openClockByVisit.has(v.id)}
                      lang={lang}
                    />
                    <OnMyWayButton visitId={v.id} lang={lang} />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!completed && (
                    <MarkDoneButton
                      action={action}
                      projectId={project?.id}
                      photoCount={photoCount}
                      lang={lang}
                    />
                  )}
                  {project && (
                    <Link
                      href={`/crew/upload?project_id=${project.id}`}
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
                    >
                      📷 {hasPhoto ? t(lang, "Add photo") : t(lang, "Required photo")}
                    </Link>
                  )}
                  {project && (
                    <Link
                      href={`/crew/form?visit_id=${v.id}&project_id=${project.id}`}
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
                    >
                      📝 {t(lang, "Forms")}
                    </Link>
                  )}
                </div>
                {completed && (
                  <p className="mt-2 text-xs font-semibold text-green-700">
                    ✓ {t(lang, "Marked complete")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
