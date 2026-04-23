import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";
import { CrewJobCard, type CrewJobCardData } from "../job-card";
import { WeekStrip } from "./week-strip";
import { ViewToggle, type ScheduleView } from "./view-toggle";
import { DayGrid, type DayGridVisit } from "./day-grid";
import { CrewHomeMap } from "../home-map";

export const metadata = { title: "Schedule — Rose Concrete" };

type SearchParams = Promise<{ d?: string; view?: string }>;

function weekStartIso(d: Date): string {
  // Sunday-anchored (matches Jobber mobile's S M T W T F S strip).
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(12, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}
function normalizeView(raw: string | undefined): ScheduleView {
  if (raw === "day" || raw === "list" || raw === "map") return raw;
  return "list";
}
function toCardStatus(s: string): CrewJobCardData["status"] {
  if (s === "completed" || s === "cancelled") return "completed";
  if (s === "in_progress") return "in_progress";
  return "upcoming";
}

/**
 * Crew schedule — Jobber-mobile parity.
 *   - Month label + dropdown arrow (top left)
 *   - Day / List / Map segmented toggle (top right)
 *   - S M T W T F S week strip (today circled green)
 *   - Body swaps with the view toggle:
 *       Day  — hour-grid with colored blocks
 *       List — stacked visit cards with colored border
 *       Map  — faux map with pins + Route CTA
 */
export default async function CrewSchedule({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();
  const lang = await getLangPref();
  const sp = await searchParams;

  const today = new Date();
  const selectedIso = sp.d ?? today.toISOString().slice(0, 10);
  const view = normalizeView(sp.view);
  const weekStart = weekStartIso(new Date(selectedIso + "T12:00:00"));
  const weekStartDate = new Date(weekStart + "T00:00:00");
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: weekVisits } = await supabase
    .from("visits")
    .select(
      "id, scheduled_for, duration_min, status, project:projects(id, name, location, service_address, client:clients(name))",
    )
    .gte("scheduled_for", weekStartDate.toISOString())
    .lt("scheduled_for", weekEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  const all = (weekVisits ?? []).map((v) => {
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    const client = p?.client
      ? Array.isArray(p.client)
        ? p.client[0]
        : p.client
      : null;
    const iso = new Date(v.scheduled_for).toISOString().slice(0, 10);
    return {
      id: v.id as string,
      iso,
      raw: v.scheduled_for as string,
      duration: v.duration_min as number | null,
      status: v.status as string,
      title: (p?.name ?? "Visit") as string,
      clientName: (client?.name as string | null) ?? null,
      address: (p?.service_address ?? p?.location ?? null) as string | null,
    };
  });

  const counts: Record<string, number> = {};
  for (const v of all) counts[v.iso] = (counts[v.iso] ?? 0) + 1;
  const selectedDay = all.filter((v) => v.iso === selectedIso);

  const monthLabel = weekStartDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-1 text-xl font-extrabold text-[#1a2332] dark:text-white">
          {monthLabel}
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-neutral-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </h1>
        <ViewToggle value={view} />
      </div>

      <WeekStrip start={weekStart} selected={selectedIso} counts={counts} />

      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1a2332] dark:text-white">
            {user.full_name ?? user.email.split("@")[0]}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {selectedDay.length}{" "}
            {selectedDay.length === 1 ? "visit" : "visits"}
            {" · "}
            {formatDayLabel(selectedIso)}
          </p>
        </div>
      </div>

      {selectedDay.length === 0 ? (
        <EmptyCard lang={lang} />
      ) : view === "day" ? (
        <DayGrid
          visits={selectedDay.map(
            (v): DayGridVisit => ({
              id: v.id,
              scheduled_for: v.raw,
              duration_min: v.duration,
              title: v.title,
              clientName: v.clientName,
              status: toCardStatus(v.status),
            }),
          )}
        />
      ) : view === "map" ? (
        <CrewHomeMap
          pins={selectedDay.map((v) => ({ id: v.id, address: v.address }))}
          allAddresses={selectedDay
            .map((v) => v.address)
            .filter((a): a is string => Boolean(a))}
        />
      ) : (
        <div className="space-y-2">
          {selectedDay.map((v) => (
            <CrewJobCard
              key={v.id}
              visit={{
                id: v.id,
                title: v.title,
                time: new Date(v.raw).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
                clientName: v.clientName,
                address: v.address,
                status: toCardStatus(v.status),
                durationMin: v.duration,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function EmptyCard({ lang }: { lang: "en" | "es" }) {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-neutral-800">
      <p className="text-5xl">🏖</p>
      <p className="mt-3 text-base font-semibold text-[#1a2332] dark:text-white">
        {t(lang, "Nothing scheduled today. Enjoy the breather.")}
      </p>
    </div>
  );
}
