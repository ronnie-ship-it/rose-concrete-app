"use client";

import { useActionState, useState } from "react";
import { createExpenseAction, type ExpenseResult } from "./actions";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";

export function ExpenseForm({
  projects,
}: {
  projects: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ExpenseResult | null,
    FormData
  >(createExpenseAction, null);

  if (!open) {
    return (
      <div>
        <PrimaryButton type="button" onClick={() => setOpen(true)}>
          + Log expense
        </PrimaryButton>
        {state?.ok === true && (
          <span className="ml-3 text-sm text-emerald-700">Expense saved.</span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <form action={formAction} className="grid gap-3 md:grid-cols-6">
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Vendor
          </span>
          <input
            name="vendor"
            placeholder="Home Depot, Catalina Pacific…"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Category
          </span>
          <select
            name="category"
            defaultValue="materials"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="materials">Materials</option>
            <option value="concrete">Concrete</option>
            <option value="rebar">Rebar</option>
            <option value="equipment_rental">Equipment rental</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="fuel">Fuel</option>
            <option value="permit_fee">Permit fee</option>
            <option value="labor">Labor</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Amount
          </span>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            min={0}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Date
          </span>
          <input
            name="expense_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Paid from
          </span>
          <select
            name="paid_from"
            defaultValue="card"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="card">Card</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="ach">ACH</option>
          </select>
        </label>
        <label className="md:col-span-3">
          <span className="block text-xs font-medium text-neutral-600">
            Project
          </span>
          <select
            name="project_id"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-3">
          <span className="block text-xs font-medium text-neutral-600">
            Note
          </span>
          <input
            name="note"
            placeholder="45 bags of QUIKRETE + delivery"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-6 flex items-center justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setOpen(false)}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Log expense"}
          </PrimaryButton>
        </div>
        {state?.ok === false && (
          <p className="md:col-span-6 text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </Card>
  );
}
