import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { stepIsStale, type ProjectWorkflowStep } from "@/lib/workflows";

export const metadata = { title: "Workflows — Rose Concrete" };

/**
 * All active projects that have a workflow (today: sidewalk permits).
 * Shows the current step per project, due date, staleness badge, and a
 * link into the project. Drives Ronnie's Monday-morning triage.
 */
export default async function WorkflowsDashboard() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  // Pull every non-done project with steps. One round-trip + group in memory.
  const { data: rows } = await supabase
    .from("project_workflow_steps")
    .select(
      "*, project:projects(id, name, service_type, status, client:clients(name))"
    )
    .order("project_id")
    .order("sequence");

  // Group by project.
  type ProjectGroup = {
    projectId: string;
    projectName: string;
    serviceType: string | null;
    projectStatus: string;
    clientName: string | null;
    steps: ProjectWorkflowStep[];
  };
  const groups = new Map<string, ProjectGroup>();
  for (const r of (rows ?? []) as Array<
    ProjectWorkflowStep & {
      project:
        | {
            id: string;
            name: string;
            service_type: string | null;
            status: string;
            client: { name: string } | { name: string }[] | null;
          }
        | Array<{
            id: string;
            name: string;
            service_type: string | null;
            status: string;
            client: { name: string } | { name: string }[] | null;
          }>
        | null;
    }
  >) {
    const proj = Array.isArray(r.project) ? r.project[0] : r.project;
    if (!proj) continue;
    if (proj.status === "done" || proj.status === "cancelled") continue;
    const client = Array.isArray(proj.client) ? proj.client[0] : proj.client;
    if (!groups.has(proj.id)) {
      groups.set(proj.id, {
        projectId: proj.id,
        projectName: proj.name,
        serviceType: proj.service_type,
        projectStatus: proj.status,
        clientName: client?.name ?? null,
        steps: [],
      });
    }
    groups.get(proj.id)!.steps.push(r);
  }

  const active = Array.from(groups.values()).filter((g) =>
    g.steps.some((s) => s.status !== "done" && s.status !== "skipped")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        subtitle={`${active.length} active job${active.length === 1 ? "" : "s"} in progress`}
      />

      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No active workflow jobs. Tag a project as{" "}
          <span className="font-mono">sidewalk</span> to spin up the 11-step
          permit workflow.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Current step</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Progress</th>
              </tr>
            </thead>
            <tbody>
              {active.map((g) => {
                // "Current" = first non-terminal step (in_progress first,
                // else earliest pending).
                const inProgress = g.steps.find((s) => s.status === "in_progress");
                const firstPending = g.steps.find((s) => s.status === "pending");
                const current = inProgress ?? firstPending ?? g.steps[0];
                const doneCount = g.steps.filter((s) => s.status === "done").length;
                const stale = current ? stepIsStale(current) : false;
                return (
                  <tr
                    key={g.projectId}
                    className={`border-t border-neutral-100 hover:bg-neutral-50 ${
                      stale ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/projects/${g.projectId}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        {g.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {g.clientName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-neutral-500">
                      {g.serviceType ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-neutral-500">
                          {current?.sequence}/{g.steps.length}
                        </span>
                        <span className="text-neutral-800">{current?.title}</span>
                        {stale && (
                          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                            stale
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {current?.due_date ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded bg-neutral-200">
                          <div
                            className="h-full bg-brand-500"
                            style={{
                              width: `${(doneCount / g.steps.length) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-neutral-500">
                          {doneCount}/{g.steps.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
