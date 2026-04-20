"use client";

import { useActionState } from "react";
import {
  saveBusinessProfileAction,
  type BusinessProfileResult,
} from "./actions";

type Hours = Record<
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
  { open: string | null; close: string | null }
>;

const DAY_LABELS: Array<[keyof Hours, string]> = [
  ["sun", "Sunday"],
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
];

export function BusinessProfileForm({
  initial,
}: {
  initial: {
    company_name: string;
    legal_name: string | null;
    tagline: string | null;
    bio: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    license_number: string | null;
    public_listing: boolean;
    keep_address_private: boolean;
    hours: Hours;
    welcome_video_url: string | null;
    phase_text_demo: string | null;
    phase_text_prep: string | null;
    phase_text_pour: string | null;
    phase_text_cleanup: string | null;
    phase_to_demo: string | null;
    phase_to_pour: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<
    BusinessProfileResult | null,
    FormData
  >(saveBusinessProfileAction, null);

  return (
    <form action={formAction} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Company name" name="company_name" required defaultValue={initial.company_name} />
        <Field label="Legal name" name="legal_name" defaultValue={initial.legal_name ?? ""} />
        <Field label="Tagline" name="tagline" defaultValue={initial.tagline ?? ""} />
        <Field label="License #" name="license_number" defaultValue={initial.license_number ?? ""} />
      </section>

      <label className="block">
        <span className="block text-xs font-medium text-neutral-600">
          Client-hub bio
        </span>
        <textarea
          name="bio"
          rows={3}
          defaultValue={initial.bio ?? ""}
          placeholder="Family-owned concrete contractor serving San Diego County since…"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>

      <section className="grid gap-4 md:grid-cols-3">
        <Field label="Phone" name="phone" defaultValue={initial.phone ?? ""} />
        <Field label="Email" name="email" type="email" defaultValue={initial.email ?? ""} />
        <Field label="Website" name="website" defaultValue={initial.website ?? ""} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Field label="Street" name="address_line_1" defaultValue={initial.address_line_1 ?? ""} />
        </div>
        <div className="md:col-span-2">
          <Field label="Street 2 / Unit" name="address_line_2" defaultValue={initial.address_line_2 ?? ""} />
        </div>
        <Field label="City" name="city" defaultValue={initial.city ?? ""} />
        <Field label="State" name="state" defaultValue={initial.state ?? "CA"} />
        <Field label="ZIP" name="postal_code" defaultValue={initial.postal_code ?? ""} />
      </section>

      <section className="space-y-2">
        <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <input
            name="public_listing"
            type="checkbox"
            defaultChecked={initial.public_listing}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm">
            <span className="font-medium text-neutral-800">
              Help clients find my business
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Shows the company on public marketing listings (e.g.
              sandiegoconcrete.ai footer).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <input
            name="keep_address_private"
            type="checkbox"
            defaultChecked={initial.keep_address_private}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm">
            <span className="font-medium text-neutral-800">
              Keep street address private
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Hide the street on the client hub — shows city + state only.
            </span>
          </span>
        </label>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-800">Business hours</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Leave both fields empty to mark a day closed.
        </p>
        <div className="mt-3 space-y-2">
          {DAY_LABELS.map(([k, label]) => (
            <div
              key={k}
              className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[120px_1fr_1fr]"
            >
              <span className="text-sm text-neutral-700">{label}</span>
              <input
                type="time"
                name={`hours_${k}_open`}
                defaultValue={initial.hours?.[k]?.open ?? ""}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <input
                type="time"
                name={`hours_${k}_close`}
                defaultValue={initial.hours?.[k]?.close ?? ""}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-800">
          Welcome video
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Shown on the pre-demo acknowledgment form (YouTube / Vimeo /
          direct MP4 URL).
        </p>
        <input
          type="url"
          name="welcome_video_url"
          defaultValue={initial.welcome_video_url ?? ""}
          placeholder="https://www.youtube.com/watch?v=…"
          className="mt-2 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-800">
          Phase SMS templates
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Drafted on the project page when a phase is scheduled. Merge
          tokens: <code>{"{client_name}"}</code>, <code>{"{address}"}</code>,
          <code>{"{dates}"}</code>, <code>{"{service_type}"}</code>,
          <code>{"{notes}"}</code>. Leave blank to use sensible defaults.
        </p>
        <div className="mt-3 space-y-3">
          <TextareaField
            label="Demo text (to Willy)"
            name="phase_text_demo"
            defaultValue={initial.phase_text_demo ?? ""}
          />
          <Field
            label="Demo recipients (phone numbers, comma-separated)"
            name="phase_to_demo"
            defaultValue={initial.phase_to_demo ?? ""}
          />
          <TextareaField
            label="Prep text"
            name="phase_text_prep"
            defaultValue={initial.phase_text_prep ?? ""}
          />
          <TextareaField
            label="Pour-day text (to Willy / Roger / Michael)"
            name="phase_text_pour"
            defaultValue={initial.phase_text_pour ?? ""}
          />
          <Field
            label="Pour recipients (phone numbers, comma-separated)"
            name="phase_to_pour"
            defaultValue={initial.phase_to_pour ?? ""}
          />
          <TextareaField
            label="Cleanup text"
            name="phase_text_cleanup"
            defaultValue={initial.phase_text_cleanup ?? ""}
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {state?.ok === true && (
          <span className="text-sm text-emerald-700">Saved ✓</span>
        )}
        {state?.ok === false && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600">{label}</span>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
      />
    </label>
  );
}
