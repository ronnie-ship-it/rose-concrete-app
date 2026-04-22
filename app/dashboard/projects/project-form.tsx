"use client";

import { useActionState } from "react";
import { type ProjectFormState } from "./actions";
import { PROJECT_STATUSES } from "./constants";
import { ClientCombobox } from "@/components/client-combobox";

type ProjectRecord = {
  client_id?: string | null;
  name?: string | null;
  location?: string | null;
  status?: string | null;
  sqft?: number | string | null;
  cubic_yards?: number | string | null;
  measurement_source?: string | null;
  measurement_notes?: string | null;
};

export function ProjectForm({
  action,
  clients,
  initial,
  submitLabel = "Save project",
}: {
  action: (
    prev: ProjectFormState,
    formData: FormData
  ) => Promise<ProjectFormState>;
  clients: { id: string; name: string }[];
  initial?: ProjectRecord;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const fe = state && !state.ok && state.fieldErrors ? state.fieldErrors : {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-neutral-700">
            Client *
          </label>
          {/* Typeahead replaces the classic <select>: recent 5 by
              default, as-you-type filter, inline "+ New client" row
              at the bottom. The `clients` prop is still accepted so
              callers that pre-fetch don't need updating, but the
              combobox now owns the search. */}
          <div className="mt-1">
            <ClientCombobox
              name="client_id"
              required
              initial={
                initial?.client_id
                  ? {
                      id: initial.client_id as string,
                      name:
                        clients.find((c) => c.id === initial?.client_id)?.name ??
                        "",
                    }
                  : null
              }
            />
          </div>
          {fe.client_id && (
            <p className="mt-1 text-xs text-red-600">{fe.client_id}</p>
          )}
        </div>

        <Field
          label="Project name *"
          name="name"
          defaultValue={initial?.name ?? ""}
          error={fe.name}
          required
          className="sm:col-span-2"
        />
        <Field
          label="Location / address"
          name="location"
          defaultValue={initial?.location ?? ""}
          error={fe.location}
          className="sm:col-span-2"
        />

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-neutral-700"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "lead"}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="measurement_source"
            className="block text-sm font-medium text-neutral-700"
          >
            Measurement source
          </label>
          <select
            id="measurement_source"
            name="measurement_source"
            defaultValue={initial?.measurement_source ?? ""}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">—</option>
            <option value="moasure">MOASURE</option>
            <option value="manual">Manual</option>
            <option value="tape">Tape</option>
            <option value="plans">Plans</option>
          </select>
        </div>

        <Field
          label="Square feet"
          name="sqft"
          type="number"
          defaultValue={
            initial?.sqft != null ? String(initial.sqft) : ""
          }
          error={fe.sqft}
        />
        <Field
          label="Cubic yards"
          name="cubic_yards"
          type="number"
          defaultValue={
            initial?.cubic_yards != null ? String(initial.cubic_yards) : ""
          }
          error={fe.cubic_yards}
        />

        <div className="sm:col-span-2">
          <label
            htmlFor="measurement_notes"
            className="block text-sm font-medium text-neutral-700"
          >
            Measurement notes
          </label>
          <textarea
            id="measurement_notes"
            name="measurement_notes"
            defaultValue={initial?.measurement_notes ?? ""}
            rows={3}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  required,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-neutral-700"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
