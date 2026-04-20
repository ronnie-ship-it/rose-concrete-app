import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import {
  CreateTemplateForm,
  TemplateRow,
  type Template,
} from "./template-forms";

export const metadata = { title: "Line-item library — Rose Concrete" };

/**
 * Saved line-item library. Items here appear in the quote editor's
 * "Insert from library" picker so Ronnie can price a standard pour in
 * two taps instead of retyping it on every quote.
 */

export default async function LineItemLibraryPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("line_item_templates")
    .select(
      "id, title, description, unit, unit_price, default_quantity, is_active, sort_order"
    )
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  const templates = (data ?? []) as Template[];
  const schemaReady = !error || !error.message.includes("line_item_templates");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Line-item library"
        subtitle="Standard pricing Ronnie drops into quotes with one tap. Sort order controls position in the picker; inactive items stay hidden until re-enabled."
      />

      {!schemaReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Run migration 011 first.</p>
          <p className="mt-1">
            Paste <code>migrations/011_line_item_library.sql</code> into the
            Supabase SQL editor and reload.
          </p>
        </div>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-neutral-900">
          New template
        </h2>
        <div className="mt-3">
          <CreateTemplateForm />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-neutral-900">
          Current library
        </h2>
        <div className="mt-3">
          {templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              description="Add your standard line items above — 4-inch driveway pour, stamped upcharge, rebar grid, etc. — so quotes take two taps instead of two minutes."
            />
          ) : (
            <div>
              <div className="hidden grid-cols-12 gap-2 border-b border-neutral-200 pb-2 text-xs uppercase tracking-wide text-neutral-500 sm:grid">
                <div className="col-span-4">Title / description</div>
                <div className="col-span-1">Unit</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-1">Sort</div>
                <div className="col-span-1 text-center">Active</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {templates.map((t) => (
                <TemplateRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
