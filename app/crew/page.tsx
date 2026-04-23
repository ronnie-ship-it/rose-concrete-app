import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";
import { ClockButton } from "./clock-button";
import { CrewJobCard, type CrewJobCardData } from "./job-card";
import { CrewHomeMap } from "./home-map";
import { CreateFab } from "./create-fab";
import Link from "next/link";
import { money } from "@/lib/format";

export const metadata = { title: "Home — Rose Concrete" };

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
function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Crew home screen — Jobber mobile parity.
 *
 *   ┌───────────────────────────────────┐
 *   │  Good morning, Alex               │   greeting + first-name
 *   │  (4 visits · $12,400 today)       │   scaled-down summary
 *   │                                   │
 *   │  ┌─────────────────────────────┐  │   "Let's get started" card
 *   │  │ Let's get started           │  │   w/ primary green clock-in
 *   │  │ [▶ Clock in]                │  │
 *   │  └─────────────────────────────┘  │
 *   │                                   │
 *   │  [ faux map with job pins ]      │
 *   │  4 stops today · Route in Maps → │
 *   │                                   │
 *   │  Today's jobs ━━━━━━━━━━━━━━━    │   horizontal scroller
 *   │  [card] [card] [card] →           │
 *   │                                   │
 *   │  This week                        │
 *   │  [card] [card] [card]             │   vertical list
 *   │                                   │
 *   └───────────────────────────────────┘
 *                                   (●)  <- FAB
 */
export default async function CrewHome() {
  const user = await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();
  const lang = await getLangPref();

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: visits } = await supabase
    .from("visits")
    .select(
      "id, scheduled_for, duration_min, status, notes, project:projects(id, name, location, service_address, revenue_cached, client:clients(name, phone))",
    )
    .gte("scheduled_for", todayStart.toISOString())
    .lt("scheduled_for", weekEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  // Split into today vs rest-of-week.
  const todayVisits = (visits ?? []).filter(
    (v) => new Date(v.scheduled_for) <= todayEnd,
  );
  const weekVisits = (visits ?? []).filter(
    (v) => new Date(v.scheduled_for) > todayEnd,
  );

  // Any open clock-in for this user on today's visits?
  const todayVisitIds = todayVisits.map((v) => v.id as string);
  const { data: openClocks } =
    todayVisitIds.length > 0
      ? await supabase
          .from("visit_time_entries")
          .select("visit_id")
          .eq("user_id", user.id)
          .in("visit_id", todayVisitIds)
          .is("clock_out_at", null)
      : { data: [] as { visit_id: string }[] };
  const openClockSet = new Set((openClocks ?? []).map((c) => c.visit_id));
  const currentOpenVisit = todayVisits.find((v) =>
    openClockSet.has(v.id as string),
  );

  const toCard = (
    v: (typeof todayVisits)[number],
  ): CrewJobCardData => {
    const project = Array.isArray(v.project) ? v.project[0] : v.project;
    const client = project?.client
      ? Array.isArray(project.client)
        ? project.client[0]
        : project.client
      : null;
    const time = new Date(v.scheduled_for).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    let status: CrewJobCardData["status"] = "upcoming";
    if (v.status === "completed") status = "completed";
    else if (v.status === "in_progress" || openClockSet.has(v.id as string))
      status = "in_progress";
    else if (new Date(v.scheduled_for) < today && v.status !== "completed")
      status = "late";
    return {
      id: v.id as string,
      title: project?.name ?? "Visit",
      time,
      clientName: client?.name ?? null,
      address: project?.service_address ?? project?.location ?? null,
      status,
      durationMin: v.duration_min as number | null,
    };
  };

  const todayCards = todayVisits.map(toCard);
  const weekCards = weekVisits.map(toCard);

  const completedCount = todayCards.filter((c) => c.status === "completed")
    .length;
  const revenueToday = todayVisits.reduce((sum, v) => {
    const p = Array.isArray(v.project) ? v.project[0] : v.project;
    return sum + Number(p?.revenue_cached ?? 0);
  }, 0);

  const firstName = (user.full_name ?? user.email.split("@")[0])
    .split(/\s+/)[0];

  return (
    <div className="space-y-5">
      {/* Greeting + summary */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1a2332] dark:text-white">
          {greeting(today)}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          {todayCards.length > 0 ? (
            <>
              {todayCards.length} {todayCards.length === 1 ? "visit" : "visits"}
              {revenueToday > 0 ? (
                <>
                  {" · "}
                  <span className="font-semibold text-[#1a2332] dark:text-white">
                    {money(revenueToday)}
                  </span>{" "}
                  today
                </>
              ) : (
                " today"
              )}
              {completedCount > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-[#4A7C59]">
                    {completedCount} complete
                  </span>
                </>
              )}
              {" · "}
              <Link
                href="/crew/schedule"
                className="text-[#4A7C59] underline"
              >
                {t(lang, "View all")}
              </Link>
            </>
          ) : (
            t(lang, "Nothing scheduled today. Enjoy the breather.")
          )}
        </p>
      </div>

      {/* Let's get started — primary clock-in card */}
      {todayCards.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-800">
          <h2 className="text-base font-bold text-[#1a2332] dark:text-white">
            Let&apos;s get started
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {currentOpenVisit
              ? `Currently on ${toCard(currentOpenVisit).title} — clock out when you're done.`
              : `Clock in on your first visit and we'll track the time from there.`}
          </p>
          <div className="mt-3">
            {currentOpenVisit ? (
              <ClockButton
                visitId={currentOpenVisit.id as string}
                isOpen={true}
                lang={lang}
              />
            ) : (
              <ClockButton
                visitId={todayCards[0].id}
                isOpen={false}
                lang={lang}
              />
            )}
          </div>
        </section>
      )}

      {/* Map preview */}
      {todayVisits.length > 0 && (
        <CrewHomeMap
          pins={todayVisits.map((v) => {
            const p = Array.isArray(v.project) ? v.project[0] : v.project;
            return {
              id: v.id as string,
              address: (p?.service_address ?? p?.location) as string | null,
            };
          })}
          allAddresses={todayVisits
            .map((v) => {
              const p = Array.isArray(v.project) ? v.project[0] : v.project;
              return (p?.service_address ?? p?.location) as string | null;
            })
            .filter((a): a is string => Boolean(a))}
        />
      )}

      {/* Today's jobs — horizontal scroller */}
      {todayCards.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1a2332] dark:text-white">
              {t(lang, "Today")}
            </h2>
            <Link
              href="/crew/schedule"
              className="text-xs font-semibold text-[#4A7C59]"
            >
              {t(lang, "View all")} →
            </Link>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {todayCards.map((c) => (
              <CrewJobCard key={c.id} visit={c} variant="rail" />
            ))}
          </div>
        </section>
      )}

      {/* This week — vertical list */}
      {weekCards.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-bold text-[#1a2332] dark:text-white">
            {t(lang, "This week")}
          </h2>
          <div className="space-y-2">
            {weekCards.slice(0, 5).map((c) => (
              <CrewJobCard key={c.id} visit={c} />
            ))}
          </div>
          {weekCards.length > 5 && (
            <Link
              href="/crew/schedule"
              className="mt-3 block text-center text-sm font-semibold text-[#4A7C59]"
            >
              See all {weekCards.length} →
            </Link>
          )}
        </section>
      )}

      <CreateFab />
    </div>
  );
}
