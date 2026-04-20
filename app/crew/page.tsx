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
  // iOS users get the native Maps handler via this scheme; Android
  // falls back to Google Maps. Appending `&navigate=yes` bumps it
  // straight into turn-by-turn on some Android builds.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

/**
 * Crew "Today" — the home screen a crew member sees when they tap
 * into the app. Rewritten 2026-04-19 for full thumb-sized tap
 * targets and a clearer visual hierarchy:
 *
 *   - Each visit is a full-width card with a colored header strip
 *     (amber = upcoming, emerald = completed).
 *   - Two big primary action rows: "Navigate + Call + On my way"
 *     and "Upload photos + Clock + Mark done".
 *   - The photo-upload CTA shows live progress (2 of 3) so crew
 *     members never have to guess whether they've hit the gate.
 *   - All buttons are min-h-14 so they clear iOS' 44-point target.
 */
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
  const photoCountByProject = new Map<string, number>();
  for (const r of photoRows ?? []) {
    const pid = r.entity_id as string;
    photoCountByProject.set(pid, (photoCountByProject.get(pid) ?? 0) + 1);
  }

  const PHOTO_MIN = 3;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          {t(lang, "Today")}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {t(lang, "Hey")} {user.full_name ?? user.email.split("@")[0]} —{" "}
          {visits?.length ?? 0}{" "}
          {tPlural(lang, visits?.length ?? 0, "visit", "visits")}{" "}
          {t(lang, "on your plate.")}
        </p>
      </div>

      {!visits || visits.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-brand-700 dark:bg-brand-800">
          <p className="text-5xl">🏖</p>
          <p className="mt-3 text-base font-semibold text-neutral-900 dark:text-white">
            {t(lang, "Nothing scheduled today. Enjoy the breather.")}
          </p>
          <Link
            href="/crew/schedule"
            className="mt-4 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t(lang, "This week")} →
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {visits.map((v) => {
            const project = Array.isArray(v.project) ? v.project[0] : v.project;
            const client =
              project &&
              (Array.isArray(project.client) ? project.client[0] : project.client);
            const address = project?.service_address ?? project?.location ?? null;
            const time = new Date(v.scheduled_for).toLocaleTimeString(
              lang === "es" ? "es-US" : "en-US",
              {
                hour: "numeric",
                minute: "2-digit",
              },
            );
            const completed = v.status === "completed";
            const action = markVisitCompleteAction.bind(null, v.id);
            const photoCount = project?.id
              ? photoCountByProject.get(project.id) ?? 0
              : 0;
            const photoGateOpen = photoCount >= PHOTO_MIN;

            return (
              <li
                key={v.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-brand-800 ${
                  completed
                    ? "border-emerald-300 opacity-80"
                    : "border-neutral-200 dark:border-brand-700"
                }`}
              >
                {/* Colored header strip — time + status at a glance */}
                <div
                  className={`flex items-center justify-between px-4 py-2 text-sm font-bold text-white ${
                    completed
                      ? "bg-emerald-600"
                      : openClockByVisit.has(v.id)
                        ? "bg-amber-600"
                        : "bg-brand-600"
                  }`}
                >
                  <span>{time}</span>
                  <span className="text-xs uppercase tracking-wider opacity-90">
                    {completed
                      ? `✓ ${t(lang, "Marked complete")}`
                      : openClockByVisit.has(v.id)
                        ? t(lang, "Clock in") // currently clocked in
                        : `${v.duration_min}m`}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-lg font-bold text-neutral-900 dark:text-white">
                      {project?.name ?? "—"}
                    </p>
                    {client?.name && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        {client.name}
                      </p>
                    )}
                  </div>

                  {v.notes && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      {v.notes}
                    </p>
                  )}

                  {/* Primary row — Navigate / Call. Full-width thumb targets. */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {address && (
                      <a
                        href={mapsHref(address)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 active:bg-neutral-50"
                      >
                        <span className="text-lg">📍</span>
                        <span className="truncate">
                          {address.split(",")[0]}
                        </span>
                      </a>
                    )}
                    {client?.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white active:bg-emerald-700"
                      >
                        <span className="text-lg">📞</span>
                        <span>
                          {t(lang, "Call")} {client.name?.split(/\s+/)[0]}
                        </span>
                      </a>
                    )}
                  </div>

                  {!completed && (
                    <>
                      {/* Clock in/out + On my way */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ClockButton
                          visitId={v.id}
                          isOpen={openClockByVisit.has(v.id)}
                          lang={lang}
                        />
                        <OnMyWayButton visitId={v.id} lang={lang} />
                      </div>

                      {/* Photo upload — the most prominent action on every
                          visit. Big CTA, live count, color flips green when
                          gate satisfied. */}
                      {project && (
                        <Link
                          href={`/crew/upload?project_id=${project.id}`}
                          className={`flex min-h-16 items-center justify-between gap-3 rounded-lg px-4 text-base font-bold shadow-sm active:opacity-80 ${
                            photoGateOpen
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-brand-600 text-white"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-2xl">📷</span>
                            <span>
                              {photoGateOpen
                                ? t(lang, "Add photo")
                                : t(lang, "Upload a photo")}
                            </span>
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-bold ${
                              photoGateOpen
                                ? "bg-emerald-600 text-white"
                                : "bg-white/20 text-white"
                            }`}
                          >
                            {photoCount}/{PHOTO_MIN}
                          </span>
                        </Link>
                      )}

                      {/* Mark complete + Forms */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <MarkDoneButton
                          action={action}
                          projectId={project?.id}
                          photoCount={photoCount}
                          lang={lang}
                        />
                        {project && (
                          <Link
                            href={`/crew/form?visit_id=${v.id}&project_id=${project.id}`}
                            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 active:bg-neutral-50"
                          >
                            📝 {t(lang, "Forms")}
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
