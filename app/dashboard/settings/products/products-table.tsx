"use client";

import { useActionState, useState, useTransition } from "react";
import {
  upsertProductAction,
  deleteProductAction,
  type ProductResult,
} from "./actions";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import { money } from "@/lib/format";

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

export function ProductsTable({
  rows,
  addOnly,
}: {
  rows: Row[];
  addOnly?: boolean;
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(addOnly ?? false);

  if (addOnly) {
    return (
      <ProductForm
        onDone={() => setAdding(false)}
        asAdd
      />
    );
  }

  return (
    <Card className="p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Cost</th>
            <th className="px-3 py-2 text-right">Margin</th>
            <th className="px-3 py-2">Tax?</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-4 text-center text-neutral-500"
              >
                No products in this category.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const isEditing = editing?.id === r.id;
              const unit = Number(r.unit_price);
              const cost = r.cost != null ? Number(r.cost) : null;
              const margin =
                cost != null && Number.isFinite(cost) && unit > 0
                  ? ((unit - cost) / unit) * 100
                  : null;
              return (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 last:border-0 align-top"
                >
                  {isEditing ? (
                    <td colSpan={8} className="px-3 py-3">
                      <ProductForm
                        initial={r}
                        onDone={() => setEditing(null)}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <p className="font-medium text-neutral-900">{r.title}</p>
                        {r.description && (
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {r.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.unit}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {money(r.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-600">
                        {r.cost != null ? money(r.cost) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {margin != null ? `${margin.toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.is_taxable ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px]">
                            taxable
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-400">
                            non-tax
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {r.is_active ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                              active
                            </span>
                          ) : (
                            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700">
                              off
                            </span>
                          )}
                          {r.is_bookable_online === false && (
                            <span
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900"
                              title="Hidden from the public booking form"
                            >
                              no booking
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="text-xs text-brand-700 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {!adding && rows.length > 0 && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-brand-700 hover:underline"
          >
            + Add to this category
          </button>
        </div>
      )}
      {adding && (
        <div className="border-t border-neutral-100 p-3">
          <ProductForm
            onDone={() => setAdding(false)}
            initial={
              rows[0]
                ? ({
                    ...rows[0],
                    id: "",
                    title: "",
                    description: null,
                  } as unknown as Row)
                : undefined
            }
            asAdd
          />
        </div>
      )}
    </Card>
  );
}

function ProductForm({
  initial,
  onDone,
  asAdd,
}: {
  initial?: Row;
  onDone: () => void;
  asAdd?: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ProductResult | null,
    FormData
  >(upsertProductAction, null);
  const [deleting, startDelete] = useTransition();

  if (state?.ok === true) setTimeout(onDone, 0);

  return (
    <form action={formAction} className="grid gap-2 md:grid-cols-6 text-sm">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <label className="md:col-span-3">
        <span className="block text-[11px] font-medium text-neutral-600">
          Title
        </span>
        <input
          name="title"
          required
          defaultValue={initial?.title ?? ""}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label className="md:col-span-2">
        <span className="block text-[11px] font-medium text-neutral-600">
          Category
        </span>
        <input
          name="category"
          defaultValue={initial?.category ?? "General"}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Unit
        </span>
        <input
          name="unit"
          defaultValue={initial?.unit ?? "job"}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label className="md:col-span-6">
        <span className="block text-[11px] font-medium text-neutral-600">
          Description
        </span>
        <textarea
          name="description"
          rows={2}
          defaultValue={initial?.description ?? ""}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Unit price
        </span>
        <input
          name="unit_price"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={
            initial ? String(Number(initial.unit_price ?? 0)) : "0"
          }
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Cost (internal)
        </span>
        <input
          name="cost"
          type="number"
          step="0.01"
          min={0}
          defaultValue={
            initial?.cost != null ? String(Number(initial.cost)) : ""
          }
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Default qty
        </span>
        <input
          name="default_quantity"
          type="number"
          step="0.01"
          min={0}
          defaultValue={String(Number(initial?.default_quantity ?? 1))}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Sort order
        </span>
        <input
          name="sort_order"
          type="number"
          defaultValue={initial?.sort_order ?? 100}
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-1 text-xs md:col-span-1">
        <input
          type="checkbox"
          name="is_taxable"
          defaultChecked={initial?.is_taxable ?? true}
        />
        Taxable
      </label>
      <label className="flex items-center gap-1 text-xs md:col-span-1">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial?.is_active ?? true}
        />
        Active
      </label>
      <label
        className="flex items-center gap-1 text-xs md:col-span-2"
        title="Show this service on the public online booking form"
      >
        <input
          type="checkbox"
          name="is_bookable_online"
          defaultChecked={initial?.is_bookable_online ?? true}
        />
        Show on booking form
      </label>
      <label className="md:col-span-2">
        <span className="block text-[11px] font-medium text-neutral-600">
          Booking display name (optional)
        </span>
        <input
          name="booking_display_name"
          defaultValue={initial?.booking_display_name ?? ""}
          placeholder="Defaults to the title"
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      </label>
      <div className="md:col-span-6 flex items-center justify-end gap-2">
        {state?.ok === false && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
        {initial?.id && !asAdd && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`Delete "${initial.title}"?`)) return;
              startDelete(async () => {
                await deleteProductAction(initial.id);
              });
            }}
            className="mr-auto rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700"
          >
            Delete
          </button>
        )}
        <SecondaryButton type="button" onClick={onDone}>
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : initial?.id ? "Save" : "Add product"}
        </PrimaryButton>
      </div>
    </form>
  );
}
