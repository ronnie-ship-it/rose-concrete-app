import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";

export const metadata = { title: "My week — Rose Concrete" };

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  return out;
}

export default async function CrewWeek() {
  await requireRole(["crew"]);
  const supabase = await createClient();
  const lang = await getLangPref();
  // Date formatter locale — Spanish users see "lunes, abr 19" instead
  // of "Monday, Apr 19". Day labels localize via toLocaleDateString.
  const dateLocale = lang === "es" ? "es-US" : "en-US";

  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 7);

  const { data: visits } = await supabase
    .from("visits")
    .select(
      "id, scheduled_for, duration_min, status, project:projects(id, name, location, service_address, client:clients(name, phone))"
    )
    .gte("scheduled_for", weekStart.toISOString())
    .lt("scheduled_for", weekEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  // Bucket by day.
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const buckets = new Map<string, typeof visits>();
  for (const d of days) buckets.set(d.toDateString(), []);
  for (const v of visits ?? []) {
    const key = new Date(v.scheduled_for).toDateString();
    buckets.get(key)?.push(v);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-neutral-900">
        {t(lang, "This week")}
      </h1>
      <div className="space-y-4">
        {days.map((d) => {
          const dayVisits = buckets.get(d.toDateString()) ?? [];
          const isToday = new Date().toDateString() === d.toDateString();
          return (
            <section key={d.toISOString()}>
              <h2
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isToday ? "text-brand-600" : "text-neutral-500"
                }`}
              >
                {d.toLocaleDateString(dateLocale, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
              {dayVisits.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-400">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {dayVisits.map((v) => {
                    const project = Array.isArray(v.project)
                      ? v.project[0]
                      : v.project;
                    const client = project?.client
                      ? Array.isArray(project.client)
                        ? project.client[0]
                        : project.client
                      : null;
                    const address =
                      project?.service_address ?? project?.location ?? null;
                    const time = new Date(v.scheduled_for).toLocaleTimeString(
                      dateLocale,
                      { hour: "numeric", minute: "2-digit" }
                    );
                    return (
                      <li
                        key={v.id}
                        className="rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm"
                      >
                        <p className="font-semibold text-neutral-900">
                          {time} · {project?.name ?? "—"}
                        </p>
                        {client && (
                          <p className="mt-0.5 text-xs text-neutral-600">
                            {client.name}
                            {client.phone && (
                              <a
                                href={`tel:${client.phone}`}
                                className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                              >
                                📞 {t(lang, "Call")}
                              </a>
                            )}
                          </p>
                        )}
                        {address && (
                          <a
                            href={`https://www.google.com/maps/?q=${encodeURIComponent(address)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex rounded-md border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700"
                          >
                            📍 {address}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
