import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";
import { money } from "@/lib/format";
import { VisitTabs } from "./visit-tabs";
import { VisitActionsBar } from "./visit-actions-bar";
import { OnMyWayButton } from "../../on-my-way-button";
import { ClockButton } from "../../clock-button";

export const metadata = { title: "Visit — Rose Concrete" };

type Params = Promise<{ id: string }>;

/**
 * Crew visit detail — Jobber mobile parity.
 *
 *   ┌───────────────────────────────────┐
 *   │  ← [back]              ☎  ⋯     │   header: back + phone icon
 *   │                                   │
 *   │  🚛 Upcoming                      │   status badge with truck
 *   │  Driveway pour — 1234 Oak St      │   bold title
 *   │  Ronnie's Crew · $8,400           │   green-ish subtitle
 *   │  📍 1234 Oak St, San Diego →     │   tap = Google Maps
 *   │                                   │
 *   │  [ Directions ] [ On my way ]    │   side-by-side CTAs
 *   │                                   │
 *   │  Tue Apr 21 · 8:00–11:00 AM       │   date range
 *   │                                   │
 *   │  [  ▶  Start Visit     ] [ ⋯ ]   │   primary green + menu
 *   │                                   │
 *   │  ╭──────┬──────╮                 │
 *   │  │ Details │ Notes │              │   tab switcher
 *   │  ╰──────┴──────╯                 │
 *   │                                   │
 *   │  LINE ITEMS                    +  │
 *   │  • Demo existing slab · $1,200    │
 *   │  • Form + pour 4" slab · $6,400   │
 *   │                                   │
 *   │  SCHEDULE                         │
 *   │  📅 Tue Apr 21 · 8:00 AM          │
 *   │  ⏱  3h duration                    │
 *   │                                   │
 *   │  TEAM                             │
 *   │  🟢 Ronnie Rose                   │
 *   │  🟢 Alex Martinez                 │
 *   │                                   │
 *   └───────────────────────────────────┘
 */
export default async function CrewVisitDetail({ params }: { params: Params }) {
  const user = await requireRole(["crew", "admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();
  const lang = await getLangPref();

  const { data: visit } = await supabase
    .from("visits")
    .select(
      `id, scheduled_for, duration_min, status, notes, completed_at,
       project:projects(
         id, name, service_address, location, revenue_cached,
         client:clients(id, name, phone)
       ),
       assignments:visit_assignments(
         user_id,
         profile:profiles(id, full_name, email, role)
       )`,
    )
    .eq("id", id)
    .single();

  if (!visit) notFound();

  const project = Array.isArray(visit.project) ? visit.project[0] : visit.project;
  const client = project?.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;
  const projectId = (project?.id as string | undefined) ?? "";
  const address = (project?.service_address ?? project?.location ?? null) as
    | string
    | null;
  const phone = (client?.phone ?? null) as string | null;

  // Line items — pull the accepted quote's items for this project.
  const { data: acceptedQuote } = projectId
    ? await supabase
        .from("quotes")
        .select("id")
        .eq("project_id", projectId)
        .in("status", ["accepted", "sent"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: lineItems } = acceptedQuote?.id
    ? await supabase
        .from("quote_line_items")
        .select("id, title, description, quantity, unit, unit_price, line_total, is_selected")
        .eq("quote_id", acceptedQuote.id)
        .order("position", { ascending: true })
    : { data: null };

  // Team on this visit, plus any open clock-ins (green dot = currently on-site).
  const assignments = (visit.assignments ?? []) as Array<{
    user_id: string;
    profile:
      | { id: string; full_name: string | null; email: string; role: string }
      | Array<{ id: string; full_name: string | null; email: string; role: string }>
      | null;
  }>;
  const team = assignments.map((a) => {
    const p = Array.isArray(a.profile) ? a.profile[0] : a.profile;
    return {
      id: a.user_id,
      name: p?.full_name ?? p?.email.split("@")[0] ?? "Crew",
      email: p?.email ?? "",
      role: p?.role ?? "crew",
    };
  });

  const { data: openClocks } = await supabase
    .from("visit_time_entries")
    .select("user_id")
    .eq("visit_id", id)
    .is("clock_out_at", null);
  const onSiteIds = new Set((openClocks ?? []).map((c) => c.user_id));
  const meIsOnSite = onSiteIds.has(user.id);

  const start = new Date(visit.scheduled_for);
  const end = new Date(start.getTime() + (visit.duration_min ?? 60) * 60_000);
  const dayLabel = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}–${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
  const revenue = Number(project?.revenue_cached ?? 0);

  const status = visit.status as
    | "scheduled"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show";
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
  const dirHref = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    : null;

  const detailsSlot = (
    <div className="space-y-5">
      {/* Line items */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Line items
          </h3>
          {projectId && (
            <Link
              href={`/dashboard/projects/${projectId}`}
              aria-label="Add line item"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A7B40] text-lg font-bold leading-none text-white"
            >
              +
            </Link>
          )}
        </div>
        {!lineItems || lineItems.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800 dark:text-neutral-400">
            {t(lang, "No line items yet.")}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {lineItems
              .filter((li) => li.is_selected !== false)
              .map((li) => (
                <li key={li.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1a2332] dark:text-white">
                      {li.title}
                    </p>
                    {li.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {li.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      {li.quantity} {li.unit ?? "job"} @ {money(Number(li.unit_price))}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[#1a2332] dark:text-white">
                    {money(Number(li.line_total ?? 0))}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Schedule */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Schedule
        </h3>
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-800">
          <p className="flex items-center gap-2 text-sm text-[#1a2332] dark:text-white">
            <span>📅</span>
            <span className="font-semibold">{dayLabel}</span>
            <span className="text-neutral-500 dark:text-neutral-400">
              · {timeLabel}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>⏱</span>
            <span>
              {visit.duration_min ?? 60} min duration
              {visit.completed_at && (
                <>
                  {" · "}completed{" "}
                  {new Date(visit.completed_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </>
              )}
            </span>
          </p>
        </div>
      </section>

      {/* Team */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Team ({team.length})
        </h3>
        {team.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800 dark:text-neutral-400">
            {t(lang, "Nobody assigned yet.")}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {team.map((m) => {
              const onSite = onSiteIds.has(m.id);
              const initials = (m.name || "?")
                .split(/\s+/)
                .slice(0, 2)
                .map((s) => s[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a2332] text-sm font-bold text-white">
                    {initials}
                    {onSite && (
                      <span
                        aria-label="On site"
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#1A7B40] dark:border-neutral-800"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1a2332] dark:text-white">
                      {m.name}
                      {m.id === user.id && (
                        <span className="ml-1 text-[10px] font-medium uppercase text-[#1A7B40]">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs capitalize text-neutral-500 dark:text-neutral-400">
                      {onSite ? "On site now" : m.role}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Clock in/out — only for crew who are assigned */}
      {status !== "completed" && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {meIsOnSite ? "You are clocked in" : "Your time"}
          </h3>
          <ClockButton visitId={id} isOpen={meIsOnSite} lang={lang} />
        </section>
      )}
    </div>
  );

  return (
    <div className="-mt-4 pb-4">
      {/* Header row — back + phone */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/crew/schedule"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-50 dark:bg-neutral-800"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-[#1a2332] dark:text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        {phone ? (
          <a
            href={`tel:${phone.replace(/[^+0-9]/g, "")}`}
            aria-label="Call client"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-50 dark:bg-neutral-800"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-[#1A7B40]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      {/* Status + title card */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-800">
        <StatusBadge status={status} />
        <h1 className="text-xl font-extrabold text-[#1a2332] dark:text-white">
          {project?.name ?? "Visit"}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-[#1A7B40]">
          {client?.name && <span>{client.name}</span>}
          {client?.name && revenue > 0 && <span>·</span>}
          {revenue > 0 && <span>{money(revenue)}</span>}
        </p>
        {address && mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-neutral-700 active:text-neutral-900 dark:text-neutral-300"
          >
            <span className="mt-0.5">📍</span>
            <span className="min-w-0 flex-1 underline decoration-neutral-300 underline-offset-2">
              {address}
            </span>
            <span className="text-neutral-400">→</span>
          </a>
        )}
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {dayLabel} · {timeLabel}
        </p>
      </div>

      {/* Directions + On my way — side by side */}
      {address && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={dirHref ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-[#1a2332] shadow-sm active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-[#1A7B40]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2l9 9-9 9-9-9 9-9zM12 8v8M8 12l4-4 4 4" />
            </svg>
            {t(lang, "Directions")}
          </a>
          <OnMyWayButton visitId={id} lang={lang} />
        </div>
      )}

      {/* Primary action bar */}
      <div className="mt-3">
        <VisitActionsBar visitId={id} projectId={projectId} status={status} />
      </div>

      {/* Tabs */}
      <div className="mt-5">
        <VisitTabs
          visitId={id}
          initialNotes={(visit.notes as string | null) ?? null}
          detailsSlot={detailsSlot}
        />
      </div>
    </div>
  );
}

type VisitStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

function StatusBadge({ status }: { status: VisitStatus }) {
  const config: Record<
    VisitStatus,
    { bg: string; text: string; label: string; icon: string }
  > = {
      scheduled: {
        bg: "bg-[#1A7B40]/10",
        text: "text-[#1A7B40]",
        label: "Upcoming",
        icon: "🚛",
      },
      in_progress: {
        bg: "bg-[#E8B74A]/20",
        text: "text-[#8A6A14]",
        label: "In progress",
        icon: "🚧",
      },
      completed: {
        bg: "bg-neutral-200",
        text: "text-neutral-700",
        label: "Completed",
        icon: "✅",
      },
      cancelled: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: "Cancelled",
        icon: "✖",
      },
      no_show: {
        bg: "bg-red-100",
        text: "text-red-700",
        label: "No show",
        icon: "—",
      },
    };
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${c.bg} ${c.text}`}
    >
      <span>{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
}
