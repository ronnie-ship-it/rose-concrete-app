import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { VisitForm } from "../visit-form";
import { updateVisitAction, deleteVisitAction } from "../actions";
import { DeleteVisitButton } from "./delete-button";
import { OnMyWayButton } from "./on-my-way-button";

export const metadata = { title: "Visit — Rose Concrete" };

type Params = Promise<{ id: string }>;

export default async function VisitDetailPage({ params }: { params: Params }) {
  await requireRole(["admin", "office"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: visit } = await supabase
    .from("visits")
    .select(
      "*, project:projects(id, name, client:clients(name, phone)), assignments:visit_assignments(user_id)"
    )
    .eq("id", id)
    .single();

  if (!visit) notFound();

  const [{ data: projects }, { data: crew }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client:clients(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["crew", "admin"])
      .order("full_name", { ascending: true }),
  ]);

  const assignedIds: string[] = (visit.assignments ?? []).map(
    (a: { user_id: string }) => a.user_id
  );

  const updateAction = updateVisitAction.bind(null, id);
  const deleteAction = deleteVisitAction.bind(null, id);

  const project = Array.isArray(visit.project) ? visit.project[0] : visit.project;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/schedule"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Schedule
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              {project?.name ?? "Visit"}
            </h1>
            <p className="text-sm text-neutral-600">
              Status: <strong>{visit.status}</strong>
              {visit.is_placeholder ? " · placeholder" : ""}
            </p>
          </div>
          <DeleteVisitButton action={deleteAction} />
        </div>
      </div>
      <OnMyWayButton
        visitId={visit.id}
        hasPhone={Boolean(
          (Array.isArray(project?.client)
            ? project?.client[0]?.phone
            : (project?.client as { phone?: string } | null | undefined)?.phone) ??
            null
        )}
      />
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <VisitForm
          action={updateAction}
          projects={(projects ?? []).map((p) => {
            const c = p.client as
              | { name: string }
              | { name: string }[]
              | null
              | undefined;
            return {
              id: p.id,
              name: p.name,
              client_name: Array.isArray(c)
                ? c[0]?.name ?? null
                : c?.name ?? null,
            };
          })}
          crew={crew ?? []}
          initial={{
            project_id: visit.project_id,
            scheduled_for: visit.scheduled_for,
            duration_min: visit.duration_min,
            is_placeholder: visit.is_placeholder,
            notes: visit.notes,
            assigned_user_ids: assignedIds,
          }}
        />
      </div>
    </div>
  );
}
