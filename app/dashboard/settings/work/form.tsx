"use client";

import { useActionState } from "react";
import { saveWorkSettingsAction, type WorkSettingsResult } from "./actions";

type Hours = Record<
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
  { start: string | null; end: string | null }
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

export function WorkSettingsForm({
  initial,
}: {
  initial: {
    default_visit_min: number;
    buffer_between_min: number;
    working_hours: Hours;
    first_day_of_week: number;
    timezone: string;
  };
}) {
  const [state, formAction, pending] = useActionState<
    WorkSettingsResult | null,
    FormData
  >(saveWorkSettingsAction, null);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600">
            Default visit duration (min)
          </span>
          <input
            name="default_visit_min"
            type="number"
            min={15}
            max={1440}
            step={15}
            defaultValue={initial.default_visit_min}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600">
            Buffer between visits (min)
          </span>
          <input
            name="buffer_between_min"
            type="number"
            min={0}
            max={240}
            step={5}
            defaultValue={initial.buffer_between_min}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-neutral-600">
            First day of week
          </span>
          <select
            name="first_day_of_week"
            defaultValue={String(initial.first_day_of_week)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-neutral-600">
          Timezone
        </span>
        <input
          name="timezone"
          defaultValue={initial.timezone}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-[11px] text-neutral-500">
          IANA zone identifier (e.g. <code>America/Los_Angeles</code>).
        </span>
      </label>

      <section>
        <h3 className="text-sm font-semibold text-neutral-800">
          Working hours
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Anchors the Day view on the schedule page. Leave blank to mark
          a day off-duty.
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
                name={`hours_${k}_start`}
                defaultValue={initial.working_hours?.[k]?.start ?? ""}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <input
                type="time"
                name={`hours_${k}_end`}
                defaultValue={initial.working_hours?.[k]?.end ?? ""}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
          ))}
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
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
