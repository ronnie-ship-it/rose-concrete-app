"use client";

import { useActionState, useRef } from "react";
import { createCashEntryAction, type CashResult } from "./actions";

const KINDS: Array<{ value: string; label: string }> = [
  { value: "labor", label: "Labor / wages" },
  { value: "tool_rental", label: "Tool rental" },
  { value: "delivery", label: "Delivery / tip" },
  { value: "materials", label: "Materials (cash)" },
  { value: "other", label: "Other" },
];

export function NewEntryForm({
  projects,
}: {
  projects: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<CashResult | null, FormData>(
    createCashEntryAction,
    null,
  );
  const ref = useRef<HTMLFormElement | null>(null);

  if (state?.ok) ref.current?.reset();

  return (
    <form
      ref={ref}
      action={formAction}
      className="mt-3 grid gap-2 text-sm sm:grid-cols-6"
    >
      <input
        name="entry_date"
        type="date"
        defaultValue={new Date().toISOString().slice(0, 10)}
        className="rounded border border-neutral-300 px-2 py-1 sm:col-span-2"
      />
      <input
        name="worker_name"
        required
        placeholder="Worker name"
        className="rounded border border-neutral-300 px-2 py-1 sm:col-span-2"
      />
      <select
        name="kind"
        defaultValue="labor"
        className="rounded border border-neutral-300 px-2 py-1 sm:col-span-2"
      >
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Amount USD"
        className="rounded border border-neutral-300 px-2 py-1 sm:col-span-2"
      />
      <select
        name="project_id"
        defaultValue=""
        className="rounded border border-neutral-300 px-2 py-1 sm:col-span-2"
      >
        <option value="">— Job (optional) —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        name="description"
        placeholder="Description (optional)"
        className="rounded border border-neutral-300 px-2 py-1 sm:col-span-2"
      />
      <textarea
        name="notes"
        rows={1}
        placeholder="Notes (optional)"
        className="rounded border border-neutral-300 px-2 py-1 text-xs sm:col-span-6"
      />
      <div className="flex items-center gap-2 sm:col-span-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "+ Add entry"}
        </button>
        {state && !state.ok && (
          <span className="text-xs text-red-700">{state.error}</span>
        )}
        {state?.ok && (
          <span className="text-xs text-emerald-700">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
