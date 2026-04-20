import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { addDiscountCodeAction, toggleDiscountCodeAction } from "./actions";
import { money } from "@/lib/format";

export const metadata = { title: "Discount codes — Rose Concrete" };

export default async function DiscountCodesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: codes } = await supabase
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discount codes"
        subtitle="Percent or fixed-dollar discounts Ronnie can apply to a quote."
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-brand-700">Add a code</h3>
        <form action={addDiscountCodeAction} className="mt-3 grid gap-2 sm:grid-cols-6">
          <input
            name="code"
            placeholder="SAVE10"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono uppercase sm:col-span-2"
          />
          <input
            name="label"
            placeholder="Label (optional)"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="percent_off"
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="% off"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            name="amount_off"
            type="number"
            step="0.01"
            min="0"
            placeholder="$ off"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 sm:col-span-6"
          >
            Add code
          </button>
        </form>
        <p className="mt-2 text-[11px] text-neutral-500">
          Fill either percent or amount — not both.
        </p>
      </section>

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {(codes ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No codes yet.
          </p>
        ) : (
          (codes ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-mono font-semibold text-neutral-900">
                  {c.code}{" "}
                  {!c.is_active && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase text-neutral-600">
                      inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-600">
                  {c.percent_off
                    ? `${c.percent_off}% off`
                    : c.amount_off
                    ? `${money(c.amount_off)} off`
                    : "—"}{" "}
                  · used {c.uses ?? 0} time{c.uses === 1 ? "" : "s"}
                  {c.label ? ` · ${c.label}` : ""}
                </p>
              </div>
              <form
                action={toggleDiscountCodeAction.bind(null, c.id, !c.is_active)}
              >
                <button
                  type="submit"
                  className="text-xs text-neutral-600 hover:underline"
                >
                  {c.is_active ? "Disable" : "Enable"}
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
