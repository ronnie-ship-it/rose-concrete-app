import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { ProductsTable } from "./products-table";

export const metadata = { title: "Products & Services — Rose Concrete" };

type Row = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  unit: string;
  unit_price: number | string;
  default_quantity: number | string;
  cost: number | string | null;
  is_taxable: boolean;
  is_active: boolean;
  is_bookable_online?: boolean;
  booking_display_name?: string | null;
  sort_order: number;
};

export default async function ProductsCatalogPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("line_item_templates")
    .select(
      "id, title, description, category, unit, unit_price, default_quantity, cost, is_taxable, is_active, is_bookable_online, booking_display_name, sort_order",
    )
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  const rows = (data ?? []) as Row[];

  // Group by category — Jobber's catalog is sectioned this way.
  const byCategory = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.category || "General";
    const list = byCategory.get(k) ?? [];
    list.push(r);
    byCategory.set(k, list);
  }
  const categories = Array.from(byCategory.keys()).sort();

  const activeCount = rows.filter((r) => r.is_active).length;
  const totalValueIfUsed = rows
    .filter((r) => r.is_active)
    .reduce(
      (sum, r) => sum + Number(r.unit_price) * Number(r.default_quantity ?? 1),
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Services"
        subtitle="Catalog of saved line items with default pricing. Ronnie drops these into quotes with one tap from the editor."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Active products" value={String(activeCount)} />
        <SummaryCard label="Categories" value={String(categories.length)} />
        <SummaryCard
          label="Avg. price / item"
          value={
            activeCount === 0
              ? "—"
              : money(totalValueIfUsed / activeCount)
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first product below — it'll show up in the quote editor's 'Insert from library' picker."
        />
      ) : null}

      {categories.map((c) => (
        <section key={c}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {c} ({byCategory.get(c)?.length ?? 0})
          </h2>
          <ProductsTable rows={byCategory.get(c) ?? []} />
        </section>
      ))}

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">
          Add a product
        </h3>
        <ProductsTable rows={[]} addOnly />
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}
