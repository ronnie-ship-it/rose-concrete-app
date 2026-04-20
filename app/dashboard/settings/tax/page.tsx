import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { addTaxRateAction, deleteTaxRateAction } from "./actions";

export const metadata = { title: "Tax rates — Rose Concrete" };

/**
 * Simple CRUD for tax_rates. Keep it dead simple: one default rate for
 * San Diego County + any one-offs. The quote editor picks by dropdown;
 * is_default flips automatically on the most recently added row.
 */
export default async function TaxPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: rates } = await supabase
    .from("tax_rates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax rates"
        subtitle="Configure tax rates used on quotes and invoices."
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-700">Add a rate</h3>
        <form action={addTaxRateAction} className="mt-3 grid gap-2 sm:grid-cols-5">
          <input
            name="label"
            placeholder="e.g. San Diego County"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="rate_percent"
            type="number"
            step="0.001"
            min="0"
            max="100"
            placeholder="7.750"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="is_default" /> Default
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Add
          </button>
        </form>
      </section>

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {(rates ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No tax rates configured yet.
          </p>
        ) : (
          (rates ?? []).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-neutral-900">
                  {r.label}
                  {r.is_default && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                      default
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-600">
                  {r.rate_percent}% {r.applies_to ? `· ${r.applies_to}` : ""}
                </p>
              </div>
              <form action={deleteTaxRateAction.bind(null, r.id)}>
                <button
                  type="submit"
                  className="text-xs text-red-700 hover:underline"
                >
                  Delete
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
