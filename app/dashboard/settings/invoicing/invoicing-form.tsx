"use client";

import { useActionState } from "react";
import { updateInvoiceSettings, type UpdateResult } from "./actions";

/**
 * Client form for editing `invoice_settings`. Uses useActionState so
 * success/error state survives form submission without us having to
 * manually juggle useTransition + setState.
 *
 * Percent is displayed + entered as "2.9" (percent); the server action
 * converts to the 0.0290 fraction that the DB stores.
 */

type Initial = {
  cc_fee_percent_display: string; // e.g. "2.9"
  cc_fee_flat_cents: number;
  cc_fee_absorb: boolean;
  ach_fee_percent_display: string;
  ach_fee_flat_cents: number;
  ach_fee_absorb: boolean;
  check_instructions: string;
};

type State = UpdateResult | null;

async function submit(_prev: State, formData: FormData): Promise<State> {
  return await updateInvoiceSettings(formData);
}

export function InvoicingForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submit,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-800">
          Credit card (default 2.9% + $0.30)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Percent (%)
            </span>
            <input
              name="cc_fee_percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={initial.cc_fee_percent_display}
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Flat fee (cents)
            </span>
            <input
              name="cc_fee_flat_cents"
              type="number"
              step="1"
              min="0"
              defaultValue={initial.cc_fee_flat_cents}
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <input
            name="cc_fee_absorb"
            type="checkbox"
            defaultChecked={initial.cc_fee_absorb}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm">
            <span className="font-medium text-neutral-800">
              Absorb the card fee
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              When on, Rose Concrete eats the surcharge. Default off — client
              sees the extra on their total.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6">
        <h3 className="text-sm font-semibold text-neutral-800">
          ACH bank transfer (default $10 flat)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Percent (%)
            </span>
            <input
              name="ach_fee_percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={initial.ach_fee_percent_display}
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-neutral-700">
              Flat fee (cents)
            </span>
            <input
              name="ach_fee_flat_cents"
              type="number"
              step="1"
              min="0"
              defaultValue={initial.ach_fee_flat_cents}
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <input
            name="ach_fee_absorb"
            type="checkbox"
            defaultChecked={initial.ach_fee_absorb}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm">
            <span className="font-medium text-neutral-800">
              Absorb the ACH fee
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              When on, Rose Concrete eats the $10 (or whatever the rate is).
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-6">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">
            Check instructions
          </span>
          <textarea
            name="check_instructions"
            rows={3}
            defaultValue={initial.check_instructions}
            required
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Shown on the public pay page under &quot;Pay by check&quot;.
          </p>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
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
    </form>
  );
}
