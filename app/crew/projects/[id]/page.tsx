import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money } from "@/lib/format";
import { AddressLink } from "@/components/address-link";
import { CrewCreateChrome } from "../../create/chrome";

export const metadata = { title: "Job — Rose Concrete" };

type Params = Promise<{ id: string }>;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  active: "In progress",
  done: "Complete",
  archived: "Archived",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-700",
  approved: "bg-[#1A7B40]/15 text-[#1A7B40]",
  scheduled: "bg-amber-100 text-amber-800",
  active: "bg-amber-100 text-amber-800",
  done: "bg-[#1A7B40]/15 text-[#1A7B40]",
  archived: "bg-neutral-200 text-neutral-700",
};

/**
 * Crew-app project / job detail. Read-only summary for crew users
 * who are looking at a job they're not directly assigned to (a
 * project hub view, not the per-visit view).
 *
 * For the per-visit, action-laden view (Start Visit / Complete Visit
 * / Clock In) see /crew/visits/[id]. This page just summarizes the
 * project — when, where, who's on it, total revenue.
 */
export default async function CrewProjectDetail({ params }: { params: Params }) {
  await requireRole(["crew", "admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      `id, name, status, location, service_address, revenue_cached,
       scheduled_start, created_at,
       client:clients(id, name)`,
    )
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: visits } = await supabase
    .from("visits")
    .select("id, scheduled_for, duration_min, status")
    .eq("project_id", id)
    .order("scheduled_for", { ascending: false })
    .limit(15);

  const client = project.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;
  const address = (project.service_address ?? project.location ?? null) as
    | string
    | null;

  const status = (project.status as string) ?? "draft";

  return (
    <CrewCreateChrome title="Job" saveLabel="Done" saveHref="/crew">
      <div className="px-4 pt-4">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
            STATUS_COLOR[status] ?? STATUS_COLOR.draft
          }`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
        <h1 className="mt-2 text-xl font-extrabold text-[#1a2332] dark:text-white">
          {project.name}
        </h1>
        {client && (
          <Link
            href={`/crew/clients/${client.id}`}
            className="mt-1 block text-sm font-semibold text-[#1A7B40]"
          >
            {client.name}
          </Link>
        )}
        {address && (
          <div className="mt-2">
            <AddressLink address={address} />
          </div>
        )}
        {Number(project.revenue_cached ?? 0) > 0 && (
          <p className="mt-3 text-2xl font-extrabold text-[#1a2332] dark:text-white">
            {money(Number(project.revenue_cached))}
          </p>
        )}
      </div>

      <div className="mt-5 px-4 pb-8">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Visits ({visits?.length ?? 0})
        </h2>
        {!visits || visits.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800 dark:text-neutral-400">
            No visits scheduled yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {visits.map((v) => {
              const start = new Date(v.scheduled_for as string);
              const end = new Date(
                start.getTime() + ((v.duration_min as number) ?? 60) * 60_000,
              );
              return (
                <li key={v.id}>
                  <Link
                    href={`/crew/visits/${v.id}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-[#1A7B40]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M3 9h18M8 3v4M16 3v4" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#1a2332] dark:text-white">
                        {start.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {start.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        –{" "}
                        {end.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold capitalize text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      {(v.status as string)?.replace(/_/g, " ") ?? "scheduled"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CrewCreateChrome>
  );
}
