"use client";

import { useActionState, useTransition } from "react";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type Result,
} from "./actions";
import { money } from "@/lib/format";

export type Template = {
  id: string;
  title: string;
  description: string | null;
  unit: string;
  unit_price: number | string;
  default_quantity: number | string;
  is_active: boolean;
  sort_order: number;
};

export function CreateTemplateForm() {
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    createTemplate,
    null
  );
  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 sm:grid-cols-6"
    >
      <div className="sm:col-span-3">
        <label className="block text-xs font-medium text-neutral-700">
          Title
        </label>
        <input
          name="title"
          required
          placeholder='4" driveway pour'
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block text-xs font-medium text-neutral-700">
          Description
        </label>
        <input
          name="description"
          placeholder="Rebar grid, broom finish"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Unit
        </label>
        <select
          name="unit"
          defaultValue="sqft"
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
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
          min="0"
          name="unit_price"
          defaultValue="0"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Default qty
        </label>
        <input
          type="number"
          step="any"
          min="0"
          name="default_quantity"
          defaultValue="1"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-700">
          Sort order
        </label>
        <input
          type="number"
          name="sort_order"
          defaultValue="100"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          Active
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add template"}
        </button>
        {state?.ok === false && (
          <span className="text-xs text-red-700">{state.error}</span>
        )}
        {state?.ok === true && (
          <span className="text-xs text-emerald-700">Added ✓</span>
        )}
      </div>
    </form>
  );
}

export function TemplateRow({ t }: { t: Template }) {
  const updateBound = updateTemplate.bind(null, t.id);
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    updateBound,
    null
  );
  const [deletingPending, startDelete] = useTransition();

  return (
    <form
      action={formAction}
      className="grid gap-2 border-t border-neutral-200 py-3 sm:grid-cols-12 sm:items-start"
    >
      <div className="sm:col-span-4">
        <input
          name="title"
          defaultValue={t.title}
          required
          className="block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          name="description"
          defaultValue={t.description ?? ""}
          placeholder="Description"
          className="mt-1 block w-full rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600"
        />
      </div>
      <div className="sm:col-span-1">
        <select
          name="unit"
          defaultValue={t.unit}
          className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="job">job</option>
          <option value="sqft">sqft</option>
          <option value="cu_yd">cu_yd</option>
          <option value="lf">lf</option>
          <option value="hr">hr</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <input
          type="number"
          step="any"
          name="unit_price"
          defaultValue={String(t.unit_price)}
          className="block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <p className="mt-0.5 text-xs text-neutral-500">
          {money(Number(t.unit_price))} / {t.unit}
        </p>
      </div>
      <div className="sm:col-span-1">
        <input
          type="number"
          step="any"
          name="default_quantity"
          defaultValue={String(t.default_quantity)}
          className="block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-1">
        <input
          type="number"
          name="sort_order"
          defaultValue={String(t.sort_order)}
          className="block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-1 flex items-center justify-center pt-2">
        <label className="inline-flex items-center gap-1 text-xs text-neutral-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={t.is_active}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600"
          />
          On
        </label>
      </div>
      <div className="sm:col-span-2 flex flex-col items-end gap-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={deletingPending}
          onClick={() => {
            if (!confirm(`Delete "${t.title}"?`)) return;
            startDelete(() => deleteTemplate(t.id));
          }}
          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
        {state?.ok === false && (
          <span className="text-xs text-red-700">{state.error}</span>
        )}
        {state?.ok === true && (
          <span className="text-xs text-emerald-700">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
