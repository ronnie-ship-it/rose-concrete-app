"use client";

import { useActionState } from "react";
import { updateReceiptSettings, type UpdateResult } from "./actions";

type Initial = {
  receipt_sender_email: string;
  receipt_subject_template: string;
  receipt_body_template: string;
  qbo_receipt_auto_send: boolean;
};

type State = UpdateResult | null;

async function submit(_prev: State, formData: FormData): Promise<State> {
  return await updateReceiptSettings(formData);
}

export function ReceiptsForm({
  initial,
  disabled,
}: {
  initial: Initial;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submit,
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <input
            name="qbo_receipt_auto_send"
            type="checkbox"
            defaultChecked={initial.qbo_receipt_auto_send}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm">
            <span className="font-medium text-neutral-800">
              Auto-send receipts
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              When on, every milestone that flips to "paid" queues a
              thank-you email with the QBO receipt PDF. Runs every 15
              minutes.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Sender email
          </span>
          <input
            name="receipt_sender_email"
            type="email"
            defaultValue={initial.receipt_sender_email}
            required
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Must be a Gmail account Ronnie has authorized for sending.
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Subject template
          </span>
          <input
            name="receipt_subject_template"
            type="text"
            defaultValue={initial.receipt_subject_template}
            required
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Body template
          </span>
          <textarea
            name="receipt_body_template"
            rows={8}
            defaultValue={initial.receipt_body_template}
            required
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || disabled}
            className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save settings"}
          </button>
          {state?.ok === true && (
            <span className="text-sm text-emerald-700">Saved ✓</span>
          )}
          {state?.ok === false && (
            <span className="text-sm text-red-700">{state.error}</span>
          )}
        </div>
      </fieldset>
    </form>
  );
}
