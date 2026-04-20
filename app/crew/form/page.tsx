import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormFiller } from "./form-filler";

export const metadata = { title: "Forms — Rose Concrete" };

/**
 * Crew form hub. Lists active templates scoped to the project's service
 * type; tapping one opens the checklist for that visit.
 */
export default async function CrewFormPage({
  searchParams,
}: {
  searchParams: Promise<{ visit_id?: string; project_id?: string; template_id?: string }>;
}) {
  await requireRole(["admin", "office", "crew"]);
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: project } = sp.project_id
    ? await supabase
        .from("projects")
        .select("id, name, service_type")
        .eq("id", sp.project_id)
        .maybeSingle()
    : { data: null };

  let templatesQuery = supabase
    .from("job_form_templates")
    .select("id, name, kind, items, service_type, is_required_to_complete")
    .eq("is_active", true);
  if (project?.service_type) {
    templatesQuery = templatesQuery.or(
      `service_type.is.null,service_type.eq.${project.service_type}`,
    );
  }
  const { data: templates } = await templatesQuery.order("kind");

  if (sp.template_id) {
    const tmpl = (templates ?? []).find((t) => t.id === sp.template_id);
    if (!tmpl) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Template not found or inactive.
          <Link href="/crew" className="ml-2 underline">
            Back
          </Link>
        </div>
      );
    }
    return (
      <FormFiller
        template={tmpl}
        projectId={sp.project_id ?? null}
        visitId={sp.visit_id ?? null}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/crew" className="text-xs text-brand-700 underline">
        ← Today
      </Link>
      <h1 className="text-xl font-semibold text-neutral-900">Job forms</h1>
      {project && (
        <p className="text-sm text-neutral-500">
          {project.name}
          {project.service_type && (
            <span className="ml-2 text-xs">({project.service_type})</span>
          )}
        </p>
      )}
      {(templates ?? []).length === 0 ? (
        <p className="text-sm text-neutral-500">
          No active job forms. Ask the office to add one at Settings → Job
          forms.
        </p>
      ) : (
        <ul className="space-y-2">
          {(templates ?? []).map((t) => (
            <li key={t.id}>
              <Link
                href={`/crew/form?template_id=${t.id}${sp.project_id ? `&project_id=${sp.project_id}` : ""}${sp.visit_id ? `&visit_id=${sp.visit_id}` : ""}`}
                className="block rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <p className="font-semibold text-neutral-900">{t.name}</p>
                <p className="text-xs text-neutral-500 capitalize">
                  {t.kind?.replace(/_/g, " ")}
                  {t.is_required_to_complete && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                      required
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
