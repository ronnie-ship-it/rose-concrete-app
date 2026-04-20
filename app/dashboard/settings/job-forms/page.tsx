import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import {
  createJobFormTemplateAction,
  deleteJobFormTemplateAction,
  toggleJobFormTemplateAction,
} from "./actions";

export const metadata = { title: "Job forms — Rose Concrete" };

type FormItem = { key: string; label: string; type: string; required?: boolean };

/**
 * Admin page to create checklist templates crews fill out on site.
 *
 * Item format (jsonb): { key, label, type: "check" | "text" | "photo", required? }
 *
 * Keep it simple: templates are a name + kind + free-form items list
 * (one per line in the textarea, format `type | label` where type is
 * one of check/text/photo). Instance creation is manual from the
 * project detail page — the UI for that is a follow-up.
 */
export default async function JobFormsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("job_form_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job forms &amp; checklists"
        subtitle="Pre-inspection, safety, and completion checklists crews fill out on site."
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-700">Create a template</h3>
        <form action={createJobFormTemplateAction} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              name="name"
              placeholder="Pre-pour inspection"
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              name="kind"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              defaultValue="pre_inspection"
            >
              <option value="pre_inspection">Pre-inspection</option>
              <option value="safety">Safety</option>
              <option value="completion">Completion</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Items — one per line, format: <code>type | label</code> (
              <code>type</code> is <code>check</code>, <code>text</code>, or{" "}
              <code>photo</code>; prefix <code>*</code> to require)
            </label>
            <textarea
              name="items"
              required
              rows={8}
              placeholder={`check | Forms and rebar in place\ncheck | Customer on-site walk-through done\n*photo | Photo of finished pour\n*text | Any callouts or issues`}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs shadow-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-neutral-700">
              <input type="checkbox" name="is_required_to_complete" />
              Block job from being marked complete until this form is filled
            </label>
            <button
              type="submit"
              className="ml-auto rounded-md bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Create template
            </button>
          </div>
        </form>
      </section>

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {(templates ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No templates yet.
          </p>
        ) : (
          (templates ?? []).map((t) => {
            const items = (t.items ?? []) as FormItem[];
            return (
              <div key={t.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {t.name}
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase text-neutral-600">
                        {t.kind}
                      </span>
                      {!t.is_active && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase text-amber-800">
                          inactive
                        </span>
                      )}
                      {t.is_required_to_complete && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] uppercase text-red-800">
                          required
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form
                      action={toggleJobFormTemplateAction.bind(
                        null,
                        t.id,
                        !t.is_active
                      )}
                    >
                      <button
                        type="submit"
                        className="text-xs text-neutral-600 hover:underline"
                      >
                        {t.is_active ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={deleteJobFormTemplateAction.bind(null, t.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-700 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-neutral-500 hover:underline">
                    items
                  </summary>
                  <ul className="mt-1 space-y-1 text-xs">
                    {items.map((it, i) => (
                      <li key={i}>
                        <span className="inline-block min-w-[60px] rounded bg-neutral-100 px-1.5 text-[10px] uppercase text-neutral-600">
                          {it.type}
                          {it.required ? "*" : ""}
                        </span>{" "}
                        {it.label}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
