"use client";

import { useState, useTransition, useActionState } from "react";
import {
  upsertPropertyAction,
  deletePropertyAction,
  type PropertyResult,
} from "./properties-contacts-actions";

type Property = {
  id: string;
  label: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
};

export function PropertiesPanel({
  clientId,
  properties,
}: {
  clientId: string;
  properties: Property[];
}) {
  const [editing, setEditing] = useState<Property | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, start] = useTransition();

  function mapsHref(p: Property): string | null {
    const parts = [
      p.address,
      [p.city, p.state].filter(Boolean).join(", "),
      p.postal_code,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    return `https://www.google.com/maps/?q=${encodeURIComponent(parts.join(" "))}`;
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Properties
        </h2>
        {!addOpen && !editing && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            + Add
          </button>
        )}
      </div>

      {properties.length === 0 && !addOpen ? (
        <p className="mt-2 text-xs text-neutral-500">
          No properties on file. Add one so you can organize work by
          location.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {properties.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              {editing?.id === p.id ? (
                <PropertyForm
                  clientId={clientId}
                  initial={p}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900">{p.label}</p>
                    {p.address && (
                      <a
                        href={mapsHref(p) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-neutral-600 hover:underline"
                      >
                        📍 {p.address}
                        {p.city && `, ${p.city}`}
                        {p.state && `, ${p.state}`}
                        {p.postal_code && ` ${p.postal_code}`}
                      </a>
                    )}
                    {p.notes && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {p.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="rounded px-2 py-0.5 text-[11px] text-brand-700 hover:bg-brand-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Remove property "${p.label}"?`)) return;
                        start(async () => {
                          await deletePropertyAction(clientId, p.id);
                        });
                      }}
                      className="rounded px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <div className="mt-3 rounded-md border border-dashed border-neutral-300 p-3">
          <PropertyForm clientId={clientId} onDone={() => setAddOpen(false)} />
        </div>
      )}
    </div>
  );
}

function PropertyForm({
  clientId,
  initial,
  onDone,
}: {
  clientId: string;
  initial?: Property;
  onDone: () => void;
}) {
  const bound = upsertPropertyAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    PropertyResult | null,
    FormData
  >(bound, null);

  // Close on successful submit.
  if (state?.ok === true) {
    setTimeout(onDone, 0);
  }

  return (
    <form action={formAction} className="grid gap-2 text-sm">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Label
        </span>
        <input
          name="label"
          required
          defaultValue={initial?.label ?? ""}
          placeholder="Main house / Store 3"
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Address
        </span>
        <input
          name="address"
          defaultValue={initial?.address ?? ""}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-1">
          <span className="block text-[11px] font-medium text-neutral-600">
            City
          </span>
          <input
            name="city"
            defaultValue={initial?.city ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="col-span-1">
          <span className="block text-[11px] font-medium text-neutral-600">
            State
          </span>
          <input
            name="state"
            defaultValue={initial?.state ?? "CA"}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="col-span-1">
          <span className="block text-[11px] font-medium text-neutral-600">
            ZIP
          </span>
          <input
            name="postal_code"
            defaultValue={initial?.postal_code ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <label>
        <span className="block text-[11px] font-medium text-neutral-600">
          Notes
        </span>
        <input
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      {state?.ok === false && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
