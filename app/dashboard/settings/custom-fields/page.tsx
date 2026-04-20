import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { FieldForm } from "./field-form";
import { FieldRow } from "./field-row";

export const metadata = { title: "Custom fields — Rose Concrete" };

type Row = {
  id: string;
  entity_type: "client" | "project" | "quote";
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  position: number;
  is_required: boolean;
};

export default async function CustomFieldsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_field_definitions")
    .select("id, entity_type, key, label, field_type, options, position, is_required")
    .order("entity_type", { ascending: true })
    .order("position", { ascending: true });
  const rows = (data ?? []) as Row[];

  const byEntity: Record<Row["entity_type"], Row[]> = {
    client: [],
    project: [],
    quote: [],
  };
  for (const r of rows) byEntity[r.entity_type].push(r);

  const ENTITY_LABEL: Record<Row["entity_type"], string> = {
    client: "Clients",
    project: "Jobs",
    quote: "Quotes",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom fields"
        subtitle="Add extra fields to clients, jobs, or quotes. Types: text / number / date / yes-no / dropdown. Admin-only."
      />

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-neutral-900">
          Add a custom field
        </h3>
        <FieldForm />
      </Card>

      {(["client", "project", "quote"] as const).map((e) => (
        <section key={e}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {ENTITY_LABEL[e]} ({byEntity[e].length})
          </h2>
          {byEntity[e].length === 0 ? (
            <EmptyState
              title={`No custom fields on ${ENTITY_LABEL[e].toLowerCase()}`}
              description="Add one above — it'll show on every record of this type."
            />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-neutral-100">
                {byEntity[e].map((r) => (
                  <FieldRow key={r.id} row={r} />
                ))}
              </ul>
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}
