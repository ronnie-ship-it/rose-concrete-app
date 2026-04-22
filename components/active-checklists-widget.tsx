import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { Card } from "@/components/ui";

/**
 * Dashboard widget: every active project with its checklist progress.
 *
 * Each row:
 *   - Project name + client
 *   - Progress bar (green/amber/red segments)
 *   - Counts: N done / N in progress / N overdue / N pending
 *   - Click → project detail page (anchors to workflow section)
 *
 * Color rules:
 *   - Green        — any step in `done` status
 *   - Yellow/amber — any step in `in_progress` status
 *   - Red          — any step past its due_date AND not yet done
 *   - Neutral grey — pending with no date
 *
 * We limit to 8 projects — this is a dashboard widget, not a full
 * list. Full project-page link sits at the bottom.
 */
export async function ActiveChecklistsWidget() {
  const supabase = createServiceRoleClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, client:clients(name), steps:project_workflow_steps(id, status, due_date)",
    )
    .in("status", ["approved", "scheduled", "active"])
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(20);

  type Row = {
    id: string;
    name: string;
    clientName: string | null;
    total: number;
    done: number;
    inProgress: number;
    overdue: number;
    pending: number;
  };

  const rows: Row[] = [];
  for (const p of projects ?? []) {
    const steps = (p.steps ?? []) as Array<{
      id: string;
      status: string;
      due_date: string | null;
    }>;
    if (steps.length === 0) continue; // skip projects without a checklist
    const done = steps.filter((s) => s.status === "done").length;
    const skipped = steps.filter((s) => s.status === "skipped").length;
    const inProgress = steps.filter((s) => s.status === "in_progress").length;
    const overdue = steps.filter(
      (s) =>
        s.status !== "done" &&
        s.status !== "skipped" &&
        s.due_date != null &&
        String(s.due_date).slice(0, 10) < todayIso,
    ).length;
    const pending = steps.length - done - skipped - inProgress;
    const clientRel = Array.isArray(p.client) ? p.client[0] : p.client;
    rows.push({
      id: p.id as string,
      name: p.name as string,
      clientName: (clientRel?.name as string | null) ?? null,
      total: steps.length,
      done: done + skipped,
      inProgress,
      overdue,
      pending,
    });
  }

  const sorted = rows
    .sort((a, b) => b.overdue - a.overdue || b.inProgress - a.inProgress)
    .slice(0, 8);

  if (sorted.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Active job checklists
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          No active checklists. Approve a quote to generate one.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Active job checklists
        </h2>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {sorted.length} of {rows.length}
        </span>
      </div>
      <ul className="mt-3 space-y-3">
        {sorted.map((r) => {
          const donePct = r.total ? (r.done / r.total) * 100 : 0;
          const inProgPct = r.total ? (r.inProgress / r.total) * 100 : 0;
          const overduePct = r.total ? (r.overdue / r.total) * 100 : 0;
          return (
            <li
              key={r.id}
              className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-brand-700"
            >
              <Link
                href={`/dashboard/projects/${r.id}#workflow`}
                className="block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-900 dark:text-white">
                      {r.name}
                    </p>
                    {r.clientName && (
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {r.clientName}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-neutral-500 dark:text-neutral-400">
                    {r.done}/{r.total} done
                  </div>
                </div>
                {/* Segmented progress bar — green done / amber in-prog / red overdue. */}
                <div
                  className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-brand-700"
                  aria-label={`Progress: ${r.done} done, ${r.inProgress} in progress, ${r.overdue} overdue`}
                >
                  {donePct > 0 && (
                    <span
                      className="bg-emerald-500"
                      style={{ width: `${donePct}%` }}
                    />
                  )}
                  {inProgPct > 0 && (
                    <span
                      className="bg-amber-400"
                      style={{ width: `${inProgPct}%` }}
                    />
                  )}
                  {overduePct > 0 && (
                    <span
                      className="bg-red-500"
                      style={{ width: `${overduePct}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                  {r.overdue > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">
                      {r.overdue} overdue
                    </span>
                  )}
                  {r.inProgress > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                      {r.inProgress} in progress
                    </span>
                  )}
                  {r.pending > 0 && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700 dark:bg-brand-700 dark:text-neutral-200">
                      {r.pending} pending
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
