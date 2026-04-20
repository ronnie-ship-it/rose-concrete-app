"use client";

import { useActionState } from "react";
import type { ClientFormState } from "./actions";

type ClientRecord = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  source?: string | null;
  notes?: string | null;
};

const SOURCE_OPTIONS = [
  "",
  "phone",
  "web",
  "poptin",
  "thumbtack",
  "referral",
  "walk_in",
  "repeat",
  "other",
];

export function ClientForm({
  action,
  initial,
  submitLabel = "Save client",
}: {
  action: (
    prev: ClientFormState,
    formData: FormData
  ) => Promise<ClientFormState>;
  initial?: ClientRecord;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldErrors =
    state && !state.ok && state.fieldErrors ? state.fieldErrors : {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name *"
          name="name"
          defaultValue={initial?.name ?? ""}
          error={fieldErrors.name}
          required
        />
        <Field
          label="Phone"
          name="phone"
          defaultValue={initial?.phone ?? ""}
          error={fieldErrors.phone}
          type="tel"
        />
        <Field
          label="Email"
          name="email"
          defaultValue={initial?.email ?? ""}
          error={fieldErrors.email}
          type="email"
          className="sm:col-span-2"
        />
        <Field
          label="Address"
          name="address"
          defaultValue={initial?.address ?? ""}
          error={fieldErrors.address}
          className="sm:col-span-2"
        />
        <Field
          label="City"
          name="city"
          defaultValue={initial?.city ?? ""}
          error={fieldErrors.city}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="State"
            name="state"
            defaultValue={initial?.state ?? "CA"}
            error={fieldErrors.state}
          />
          <Field
            label="ZIP"
            name="postal_code"
            defaultValue={initial?.postal_code ?? ""}
            error={fieldErrors.postal_code}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-neutral-700">
            Source
          </label>
          <select
            name="source"
            defaultValue={initial?.source ?? ""}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "" ? "—" : s}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-neutral-700">
            Notes
          </label>
          <textarea
            name="notes"
            defaultValue={initial?.notes ?? ""}
            rows={4}
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
        defaultValue={defaultValue}
        required={required}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
