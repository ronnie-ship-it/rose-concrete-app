"use client";

import { useActionState } from "react";
import { saveAutomationConfigAction, type SaveResult } from "./actions";

export function AutomationForm({
  initial,
}: {
  initial: {
    quote_followup_first_days: number;
    quote_followup_second_days: number;
    quote_cold_after_days: number;
    postjob_thankyou_days: number;
    postjob_review_days: number;
    postjob_checkin_days: number;
    review_url: string;
  };
}) {
  const [state, formAction, pending] = useActionState<
    SaveResult | null,
    FormData
  >(saveAutomationConfigAction, null);

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-brand-700">
          Quote follow-ups
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          SMS sequence sent to a client after a quote goes out but hasn&apos;t
          been accepted. Set days to 0 to disable a step.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NumField
            label="First nudge (days)"
            name="quote_followup_first_days"
            defaultValue={initial.quote_followup_first_days}
          />
          <NumField
            label="Second nudge (days)"
            name="quote_followup_second_days"
            defaultValue={initial.quote_followup_second_days}
          />
          <NumField
            label="Mark cold after (days)"
            name="quote_cold_after_days"
            defaultValue={initial.quote_cold_after_days}
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-brand-700">
          Post-job follow-ups
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          After a project flips to <code>done</code>, this sequence runs.
          Days count from <code>completed_at</code>.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NumField
            label="Thank-you (days after)"
            name="postjob_thankyou_days"
            defaultValue={initial.postjob_thankyou_days}
          />
          <NumField
            label="Review request (days after)"
            name="postjob_review_days"
            defaultValue={initial.postjob_review_days}
          />
          <NumField
            label="Check-in (days after)"
            name="postjob_checkin_days"
            defaultValue={initial.postjob_checkin_days}
          />
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Google review URL
          </label>
          <input
            name="review_url"
            type="url"
            defaultValue={initial.review_url}
            placeholder="https://g.page/r/…"
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm"
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Included in the review-request SMS. Leave blank to send the
            text without a link.
          </p>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {state?.ok === false && (
          <p className="text-xs text-red-700">{state.error}</p>
        )}
        {state?.ok && (
          <p className="text-xs text-emerald-700">Saved ✓</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function NumField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {label}
      </label>
      <input
        name={name}
        type="number"
        min={0}
        max={365}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm"
      />
    </div>
  );
}
