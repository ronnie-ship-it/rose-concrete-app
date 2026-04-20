"use client";

import { useTransition } from "react";
import {
  addLineItemAction,
  addLineItemFromTemplateAction,
  deleteLineItemAction,
  setLineItemPhotoAction,
  toggleLineItemOptionalAction,
} from "../actions";
import { money } from "@/lib/format";

type LineItem = {
  id: string;
  title: string;
  description: string | null;
  quantity: number | string;
  unit: string | null;
  unit_price: number | string;
  is_optional: boolean;
  photo_id: string | null;
  position: number;
};

type Photo = { id: string; caption: string | null; storage_key: string };

type Template = {
  id: string;
  title: string;
  description: string | null;
  unit: string;
  unit_price: number | string;
  default_quantity: number | string;
};

export function LineItemList({
  quoteId,
  items,
  photos,
  templates,
}: {
  quoteId: string;
  items: LineItem[];
  photos: Photo[];
  templates: Template[];
}) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No line items yet. Add one below or insert from the library.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {items.map((item) => (
            <LineItemRow
              key={item.id}
              quoteId={quoteId}
              item={item}
              photos={photos}
            />
          ))}
        </ul>
      )}

      {templates.length > 0 && (
        <TemplatePicker quoteId={quoteId} templates={templates} />
      )}

      <details className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand-700">
          + Add custom line item
        </summary>
        <AddLineItemForm quoteId={quoteId} photos={photos} />
      </details>
    </div>
  );
}

function TemplatePicker({
  quoteId,
  templates,
}: {
  quoteId: string;
  templates: Template[];
}) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
        Insert from library
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={pending}
            onClick={() =>
              start(() => addLineItemFromTemplateAction(quoteId, t.id))
            }
            className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-white px-3 py-1 text-xs font-medium text-brand-800 shadow-sm transition hover:bg-brand-100 disabled:opacity-60"
            title={t.description ?? undefined}
          >
            <span>{t.title}</span>
            <span className="text-neutral-500">
              {money(t.unit_price)}/{t.unit}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LineItemRow({
  quoteId,
  item,
  photos,
}: {
  quoteId: string;
  item: LineItem;
  photos: Photo[];
}) {
  const [pending, start] = useTransition();
  const photo = photos.find((p) => p.id === item.photo_id);
  const lineTotal = Number(item.quantity) * Number(item.unit_price);

  return (
    <li className="flex flex-wrap items-start gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-neutral-900">{item.title}</p>
          {item.is_optional && (
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              optional
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-xs text-neutral-600">{item.description}</p>
        )}
        <p className="mt-1 text-xs text-neutral-500">
          {item.quantity} × {money(item.unit_price)} {item.unit ?? "job"} ={" "}
          <strong>{money(lineTotal)}</strong>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
            <span>📷</span>
            <select
              value={item.photo_id ?? ""}
              disabled={pending}
              onChange={(e) =>
                start(() =>
                  setLineItemPhotoAction(
                    item.id,
                    quoteId,
                    e.target.value || null,
                  ),
                )
              }
              className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px]"
            >
              <option value="">No photo</option>
              {photos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.caption ?? p.storage_key.split("/").pop()}
                </option>
              ))}
            </select>
          </label>
          {photo && (
            <span className="text-[11px] text-neutral-500">
              {photo.caption ?? photo.storage_key.split("/").pop()}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-1 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={item.is_optional}
            disabled={pending}
            onChange={(e) =>
              start(() =>
                toggleLineItemOptionalAction(item.id, quoteId, e.target.checked)
              )
            }
            className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          Optional
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete "${item.title}"?`)) return;
            start(() => deleteLineItemAction(item.id, quoteId));
          }}
          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function AddLineItemForm({
  quoteId,
  photos,
}: {
  quoteId: string;
  photos: Photo[];
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      action={(fd) => start(() => addLineItemAction(fd))}
    >
      <input type="hidden" name="quote_id" value={quoteId} />
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-neutral-700">
          Title
        </label>
        <input
          name="title"
          required
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-neutral-700">
          Description
        </label>
        <textarea
          name="description"
          rows={2}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Quantity
        </label>
        <input
          type="number"
          step="any"
          name="quantity"
          defaultValue="1"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Unit
        </label>
        <select
          name="unit"
          defaultValue="job"
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="job">job</option>
          <option value="sqft">sqft</option>
          <option value="cu_yd">cu_yd</option>
          <option value="lf">lf</option>
          <option value="hr">hr</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Unit price ($)
        </label>
        <input
          type="number"
          step="any"
          name="unit_price"
          defaultValue="0"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Photo
        </label>
        <select
          name="photo_id"
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">— none —</option>
          {photos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.caption ?? p.storage_key.split("/").pop()}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="is_optional"
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          Mark as optional add-on
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add line item"}
        </button>
      </div>
    </form>
  );
}
