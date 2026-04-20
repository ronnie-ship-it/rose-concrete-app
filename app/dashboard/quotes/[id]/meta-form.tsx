"use client";

import { useActionState } from "react";
import type { QuoteMetaState } from "../actions";

type QuoteRow = {
  title?: string | null;
  scope_markdown?: string | null;
  personal_note?: string | null;
  valid_through?: string | null;
  deposit_percent?: number | string | null;
  deposit_amount?: number | string | null;
  deposit_nonrefundable?: boolean | null;
  warranty_months?: number | null;
  balance_terms?: string | null;
  estimated_duration_days?: number | null;
  salesperson_id?: string | null;
};

export function QuoteMetaForm({
  action,
  initial,
  profiles,
}: {
  action: (
    prev: QuoteMetaState,
    formData: FormData
  ) => Promise<QuoteMetaState>;
  initial: QuoteRow;
  profiles: Array<{ id: string; full_name: string | null; email: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="block text-sm font-medium text-neutral-700">
            Title
          </span>
          <input
            name="title"
            defaultValue={initial.title ?? ""}
            placeholder="Driveway & walkway replacement"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-sm font-medium text-neutral-700">
            Salesperson
          </span>
          <select
            name="salesperson_id"
            defaultValue={initial.salesperson_id ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label
          htmlFor="scope_markdown"
          className="block text-sm font-medium text-neutral-700"
        >
          Scope of work (markdown)
        </label>
        <textarea
          id="scope_markdown"
          name="scope_markdown"
          rows={8}
          defaultValue={initial.scope_markdown ?? ""}
          placeholder="**Demo & haul-off**, form & pour 4&quot; reinforced concrete driveway with broom finish, control joints, …"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="valid_through"
            className="block text-sm font-medium text-neutral-700"
          >
            Valid through
          </label>
          <input
            id="valid_through"
            name="valid_through"
            type="date"
            defaultValue={initial.valid_through ?? ""}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor="estimated_duration_days"
            className="block text-sm font-medium text-neutral-700"
          >
            Estimated job length (days)
          </label>
          <input
            id="estimated_duration_days"
            name="estimated_duration_days"
            type="number"
            min="0"
            defaultValue={initial.estimated_duration_days ?? ""}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor="deposit_percent"
            className="block text-sm font-medium text-neutral-700"
          >
            Deposit %
          </label>
          <input
            id="deposit_percent"
            name="deposit_percent"
            type="number"
            min="0"
            max="100"
            step="any"
            defaultValue={initial.deposit_percent ?? 50}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor="deposit_amount"
            className="block text-sm font-medium text-neutral-700"
          >
            Deposit $ (optional override)
          </label>
          <input
            id="deposit_amount"
            name="deposit_amount"
            type="number"
            min="0"
            step="any"
            defaultValue={
              initial.deposit_amount != null ? String(initial.deposit_amount) : ""
            }
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor="warranty_months"
            className="block text-sm font-medium text-neutral-700"
          >
            Warranty (months)
          </label>
          <input
            id="warranty_months"
            name="warranty_months"
            type="number"
            min="0"
            defaultValue={initial.warranty_months ?? 36}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Default 36 — Ronnie's San Diego differentiator.
          </p>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="deposit_nonrefundable"
              defaultChecked={initial.deposit_nonrefundable ?? true}
              className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
            Deposit is non-refundable
          </label>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="balance_terms"
            className="block text-sm font-medium text-neutral-700"
          >
            Balance terms
          </label>
          <input
            id="balance_terms"
            name="balance_terms"
            defaultValue={initial.balance_terms ?? "Balance due upon completion."}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="personal_note"
            className="block text-sm font-medium text-neutral-700"
          >
            Personal note from Ronnie
          </label>
          <textarea
            id="personal_note"
            name="personal_note"
            rows={3}
            defaultValue={initial.personal_note ?? ""}
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
        {pending ? "Saving…" : "Save quote"}
      </button>
    </form>
  );
}
