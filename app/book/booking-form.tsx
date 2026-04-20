"use client";

import { useActionState } from "react";
import { submitBookingAction, type BookingResult } from "./actions";
import { SERVICE_TYPES, SERVICE_LABEL } from "@/lib/service-types";
import type { BookableService } from "./page";

export function BookingForm({
  services = [],
}: {
  services?: BookableService[];
}) {
  const [state, formAction, pending] = useActionState<
    BookingResult | null,
    FormData
  >(submitBookingAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-5xl">✓</p>
        <p className="text-lg font-semibold text-brand-700">Request received.</p>
        <p className="text-sm text-neutral-600">
          We&apos;ll reply within one business day.
          {state.smsSent && " Check your texts for a confirmation."}
          {!state.smsSent && state.emailSent &&
            " Check your email for a confirmation."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Your name" name="name" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" name="phone" type="tel" />
        <Field label="Email" name="email" type="email" />
      </div>
      <Field label="Address of the job" name="address" />
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          What do you need?
        </label>
        <select
          name="service_type"
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm"
          defaultValue=""
        >
          <option value="">Pick one</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {SERVICE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {services.length > 0 && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Specific service (optional)
          </label>
          <select
            name="product_id"
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm"
            defaultValue=""
          >
            <option value="">— No preference —</option>
            {groupByCategory(services).map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.unit_price > 0
                      ? ` · from $${s.unit_price.toFixed(0)} / ${s.unit}`
                      : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-500">
            Pick one if you already know — otherwise leave it blank and
            we&apos;ll recommend a package.
          </p>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Anything else we should know?
        </label>
        <textarea
          name="message"
          rows={4}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {state?.ok === false && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request a quote"}
      </button>
    </form>
  );
}

// Group services by category so the <optgroup> labels break the list
// into "Driveway", "Patio", etc. on the form.
function groupByCategory(
  services: BookableService[],
): Array<[string, BookableService[]]> {
  const m = new Map<string, BookableService[]>();
  for (const s of services) {
    const arr = m.get(s.category) ?? [];
    arr.push(s);
    m.set(s.category, arr);
  }
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
