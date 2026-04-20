"use client";

import { useActionState, useState } from "react";
import { upsertFieldAction, type FieldResult } from "./actions";

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

export function FieldForm({
  initial,
  onDone,
}: {
  initial?: Row;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    FieldResult | null,
    FormData
  >(upsertFieldAction, null);
  const [type, setType] = useState<Row["field_type"]>(
    initial?.field_type ?? "text",
  );

  if (state?.ok === true && onDone) setTimeout(onDone, 0);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-6 text-sm">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <label className="md:col-span-2">
        <span className="block text-xs font-medium text-neutral-600">
          Attach to
        </span>
        <select
          name="entity_type"
          required
          defaultValue={initial?.entity_type ?? "client"}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5"
        >
          <option value="client">Client</option>
          <option value="project">Job (project)</option>
          <option value="quote">Quote</option>
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="block text-xs font-medium text-neutral-600">
          Field label
        </span>
        <input
          name="label"
          required
          defaultValue={initial?.label ?? ""}
          placeholder="HOA notes"
          className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
        />
      </label>
      <label className="md:col-span-2">
        <span className="block text-xs font-medium text-neutral-600">
          Field type
        </span>
        <select
          name="field_type"
          value={type}
          onChange={(e) => setType(e.target.value as Row["field_type"])}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5"
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="boolean">Yes / No</option>
          <option value="select">Dropdown</option>
        </select>
      </label>
      {type === "select" && (
        <label className="md:col-span-6">
          <span className="block text-xs font-medium text-neutral-600">
            Dropdown options (one per line, or comma-separated)
          </span>
          <textarea
            name="options"
            rows={3}
            defaultValue={
              initial?.options?.join("\n") ?? ""
            }
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 font-mono text-xs"
          />
        </label>
      )}
      <label>
        <span className="block text-xs font-medium text-neutral-600">
          Sort order
        </span>
        <input
          name="position"
          type="number"
          defaultValue={initial?.position ?? 100}
          className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
        />
      </label>
      <label className="flex items-center gap-2 text-xs md:col-span-1 md:pt-5">
        <input
          type="checkbox"
          name="is_required"
          defaultChecked={initial?.is_required}
          className="h-4 w-4"
        />
        Required
      </label>
      <div className="md:col-span-4 flex items-center justify-end gap-2">
        {state?.ok === false && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
        {state?.ok === true && !onDone && (
          <span className="text-xs text-emerald-700">Saved ✓</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : initial?.id ? "Save" : "Add field"}
        </button>
      </div>
    </form>
  );
}
