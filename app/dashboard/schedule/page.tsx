import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { optimizeRoute } from "@/lib/route-optimize";

export const metadata = { title: "Schedule — Rose Concrete" };

type SearchParams = Promise<{
  week?: string;
  day?: string;
  view?: "week" | "day" | "map";
}>;

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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { week, day, view } = await searchParams;
  const activeView =
    view === "map" ? "map" : view === "day" ? "day" : "week";

  // Day view anchors on the `day` param; week view + map anchor on `week`.
  const anchorInput = activeView === "day" && day ? day : week;
  const anchor = anchorInput ? new Date(anchorInput) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = addDays(weekStart, 7);

  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);

  const rangeStart = activeView === "day" ? dayStart : weekStart;
  const rangeEnd = activeView === "day" ? dayEnd : weekEnd;

  const supabase = await createClient();
  const { data: visits } = await supabase
    .from("visits")
    .select(
      "id, scheduled_for, duration_min, is_placeholder, status, notes, project:projects(id, name, location, service_address, client:clients(name, address, city, state, postal_code))"
    )
    .gte("scheduled_for", rangeStart.toISOString())
    .lt("scheduled_for", rangeEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const buckets: Record<string, typeof visits> = {};
  for (const d of days) buckets[isoDate(d)] = [];
  for (const v of visits ?? []) {
    const key = isoDate(new Date(v.scheduled_for));
    if (buckets[key]) buckets[key].push(v);
  }

  const prevWeek = isoDate(addDays(weekStart, -7));
  const nextWeek = isoDate(addDays(weekStart, 7));
  const prevDay = isoDate(addDays(dayStart, -1));
  const nextDay = isoDate(addDays(dayStart, 1));

  const prevHref =
    activeView === "day"
      ? `/dashboard/schedule?view=day&day=${prevDay}`
      : `/dashboard/schedule?week=${prevWeek}${
          activeView === "map" ? "&view=map" : ""
        }`;
  const nextHref =
    activeView === "day"
      ? `/dashboard/schedule?view=day&day=${nextDay}`
      : `/dashboard/schedule?week=${nextWeek}${
          activeView === "map" ? "&view=map" : ""
        }`;
  const todayHref =
    activeView === "day"
      ? `/dashboard/schedule?view=day`
      : activeView === "map"
        ? `/dashboard/schedule?view=map`
        : `/dashboard/schedule`;

  const subtitle =
    activeView === "day"
      ? dayStart.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : `Week of ${weekStart.toLocaleDateString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-neutral-300 bg-white text-sm">
              <Link
                href={`/dashboard/schedule?view=day${
                  activeView === "day" && day ? `&day=${day}` : ""
                }`}
                className={`px-3 py-2 font-medium ${
                  activeView === "day"
                    ? "bg-brand-600 text-white"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Day
              </Link>
              <Link
                href={`/dashboard/schedule${week ? `?week=${week}` : ""}`}
                className={`border-l border-neutral-300 px-3 py-2 font-medium ${
                  activeView === "week"
                    ? "bg-brand-600 text-white"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Week
              </Link>
              <Link
                href={`/dashboard/schedule?view=map${
                  week ? `&week=${week}` : ""
                }`}
                className={`border-l border-neutral-300 px-3 py-2 font-medium ${
                  activeView === "map"
                    ? "bg-brand-600 text-white"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Map
              </Link>
            </div>
            <Link
              href={prevHref}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              ←
            </Link>
            <Link
              href={todayHref}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Today
            </Link>
            <Link
              href={nextHref}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              →
            </Link>
            <Link
              href="/dashboard/schedule/new"
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              + New visit
            </Link>
          </div>
        }
      />

      {activeView === "day" ? (
        <DayView visits={(visits ?? []) as MapVisit[]} />
      ) : activeView === "map" ? (
        <MapView visits={visits ?? []} />
      ) : (
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const key = isoDate(d);
          const dayVisits = buckets[key] ?? [];
          const isToday = isoDate(new Date()) === key;
          return (
            <div
              key={key}
              className={`rounded-lg border bg-white p-3 ${
                isToday ? "border-brand-400 ring-1 ring-brand-400" : "border-neutral-200"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p className="mt-0.5 text-lg font-bold text-neutral-900">
                {d.getDate()}
              </p>
              <div className="mt-3 space-y-2">
                {dayVisits.length === 0 ? (
                  <p className="text-xs text-neutral-400">—</p>
                ) : (
                  dayVisits.map((v) => {
                    const project = Array.isArray(v.project)
                      ? v.project[0]
                      : v.project;
                    const time = new Date(v.scheduled_for).toLocaleTimeString(
                      "en-US",
                      { hour: "numeric", minute: "2-digit" }
                    );
                    return (
                      <Link
                        key={v.id}
                        href={`/dashboard/schedule/${v.id}`}
                        className={`block rounded-md border p-2 text-xs transition hover:bg-neutral-50 ${
                          v.is_placeholder
                            ? "border-amber-300 bg-amber-50"
                            : "border-neutral-200"
                        }`}
                      >
                        <p className="font-semibold text-neutral-900">{time}</p>
                        <p className="text-neutral-700">
                          {project?.name ?? "—"}
                        </p>
                        {v.is_placeholder && (
                          <p className="mt-0.5 text-[10px] uppercase text-amber-700">
                            placeholder
                          </p>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

type MapVisit = {
  id: string;
  scheduled_for: string;
  status: string;
  project:
    | {
        name: string;
        location: string | null;
        service_address: string | null;
        client:
          | {
              name: string;
              address: string | null;
              city: string | null;
              state: string | null;
              postal_code: string | null;
            }
          | { name: string; address: string | null; city: string | null; state: string | null; postal_code: string | null }[]
          | null;
      }
    | { name: string; location: string | null; service_address: string | null; client: unknown }[]
    | null;
};

/**
 * Map view for the week's visits — list every job grouped by day with a
 * one-tap "Open in Maps" link, plus a single "Route the whole day in
 * Google Maps" link that builds a multi-stop URL. We don't embed a live
 * map yet (needs a Maps JS API key + billing); this gets Ronnie 90% of
 * the value with zero infra.
 */
function MapView({ visits }: { visits: MapVisit[] }) {
  const byDay = new Map<string, MapVisit[]>();
  for (const v of visits) {
    const key = new Date(v.scheduled_for).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(v);
  }
  const days = Array.from(byDay.keys()).sort();

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        No visits this week to map.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayVisits = byDay.get(day)!;
        // Nearest-neighbor optimize — feeds Google Maps a sensible
        // stop order. Falls back to city-clustering when no lat/lng.
        const optimized = optimizeRoute(
          dayVisits.map((v) => ({
            id: v.id,
            address: addressFor(v),
            scheduled_for: v.scheduled_for,
          })),
        );
        const visitById = new Map(dayVisits.map((v) => [v.id, v]));
        const orderedVisits = optimized
          .map((o) => visitById.get(o.id))
          .filter((v): v is MapVisit => Boolean(v));
        const addresses = orderedVisits
          .map((v) => addressFor(v))
          .filter((a): a is string => Boolean(a));
        const routeUrl =
          addresses.length >= 2
            ? `https://www.google.com/maps/dir/${addresses
                .map(encodeURIComponent)
                .join("/")}`
            : null;
        return (
          <section
            key={day}
            className="rounded-lg border border-neutral-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-neutral-900">
                {new Date(day).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {dayVisits.length} stop{dayVisits.length === 1 ? "" : "s"}
                </span>
              </h3>
              {routeUrl && (
                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600"
                  title="Stops are ordered nearest-neighbor for the shortest drive."
                >
                  🗺  Route (optimized) in Google Maps
                </a>
              )}
            </div>
            <ul className="divide-y divide-neutral-100">
              {orderedVisits.map((v, idx) => {
                const project = Array.isArray(v.project) ? v.project[0] : v.project;
                const client = project?.client
                  ? Array.isArray(project.client)
                    ? project.client[0]
                    : project.client
                  : null;
                const addr = addressFor(v);
                const time = new Date(v.scheduled_for).toLocaleTimeString(
                  "en-US",
                  { hour: "numeric", minute: "2-digit" }
                );
                return (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/schedule/${v.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                          {idx + 1}
                        </span>
                        {time} · {project?.name ?? "—"}
                      </Link>
                      <p className="text-xs text-neutral-600">
                        {client?.name ?? ""}
                      </p>
                      {addr ? (
                        <p className="mt-0.5 text-xs text-neutral-500">{addr}</p>
                      ) : (
                        <p className="mt-0.5 text-xs italic text-amber-700">
                          No address on file
                        </p>
                      )}
                    </div>
                    {addr && (
                      <a
                        href={`https://www.google.com/maps/?q=${encodeURIComponent(
                          addr
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        📍 Open
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Jobber-style hour-by-hour day view. Shows 6am → 8pm with each visit
 * placed at its scheduled time + duration. Visits that fall outside the
 * 6-20 window still render in a "before / after hours" strip at the top
 * so they're never hidden.
 */
function DayView({ visits }: { visits: MapVisit[] }) {
  const START_HOUR = 6;
  const END_HOUR = 20;
  const HOURS = END_HOUR - START_HOUR;
  const ROW_HEIGHT_PX = 48;

  const inBand: MapVisit[] = [];
  const outOfBand: MapVisit[] = [];
  for (const v of visits) {
    const h = new Date(v.scheduled_for).getHours();
    if (h >= START_HOUR && h < END_HOUR) inBand.push(v);
    else outOfBand.push(v);
  }

  return (
    <div className="space-y-3">
      {outOfBand.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">
            {outOfBand.length} visit{outOfBand.length === 1 ? "" : "s"} outside
            6a–8p
          </p>
          <ul className="mt-1 space-y-0.5">
            {outOfBand.map((v) => {
              const p = Array.isArray(v.project) ? v.project[0] : v.project;
              const t = new Date(v.scheduled_for).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li key={v.id}>
                  <Link
                    href={`/dashboard/schedule/${v.id}`}
                    className="hover:underline"
                  >
                    {t} · {p?.name ?? "—"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <div className="relative min-w-[480px]">
          {/* Hour gridlines */}
          {Array.from({ length: HOURS }, (_, i) => {
            const hour = START_HOUR + i;
            const hourLabel = new Date(0, 0, 0, hour).toLocaleTimeString(
              "en-US",
              { hour: "numeric" },
            );
            return (
              <div
                key={hour}
                className="flex border-b border-neutral-100 last:border-0"
                style={{ height: ROW_HEIGHT_PX }}
              >
                <div className="w-14 shrink-0 border-r border-neutral-100 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500">
                  {hourLabel}
                </div>
                <div className="flex-1" />
              </div>
            );
          })}

          {/* Absolutely positioned visit cards */}
          {inBand.map((v) => {
            const p = Array.isArray(v.project) ? v.project[0] : v.project;
            const start = new Date(v.scheduled_for);
            const minutesFromTop =
              (start.getHours() - START_HOUR) * 60 + start.getMinutes();
            const top = (minutesFromTop / 60) * ROW_HEIGHT_PX;
            const duration = ((v as unknown as { duration_min?: number }).duration_min ?? 60);
            const height = Math.max(28, (duration / 60) * ROW_HEIGHT_PX - 4);
            const timeLabel = start.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <Link
                key={v.id}
                href={`/dashboard/schedule/${v.id}`}
                className="absolute left-16 right-2 rounded-md border border-brand-300 bg-brand-50 p-2 text-[11px] transition hover:bg-brand-100"
                style={{ top, height }}
              >
                <p className="font-semibold text-brand-900">
                  {timeLabel} · {p?.name ?? "—"}
                </p>
                <p className="truncate text-brand-800">
                  {(() => {
                    const c = p?.client
                      ? Array.isArray(p.client)
                        ? p.client[0]
                        : p.client
                      : null;
                    return c?.name ?? "";
                  })()}
                </p>
              </Link>
            );
          })}

          {inBand.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
              Nothing scheduled for this day.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function addressFor(v: MapVisit): string | null {
  const project = Array.isArray(v.project) ? v.project[0] : v.project;
  if (!project) return null;
  if (project.service_address) return project.service_address;
  if (project.location) return project.location;
  const client = project.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;
  if (!client) return null;
  const parts = [
    client.address,
    [client.city, client.state].filter(Boolean).join(", "),
    client.postal_code,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}
