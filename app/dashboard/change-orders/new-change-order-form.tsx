"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createChangeOrderAction,
  type ChangeOrderResult,
} from "./actions";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";

export function NewChangeOrderForm({
  projects,
}: {
  projects: Array<{ id: string; name: string; client_name: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ChangeOrderResult | null,
    FormData
  >(async (prev, fd) => {
    const res = await createChangeOrderAction(prev, fd);
    if (res.ok) {
      router.push(`/dashboard/change-orders/${res.id}`);
    }
    return res;
  }, null);

  if (!open) {
    return (
      <div>
        <PrimaryButton type="button" onClick={() => setOpen(true)}>
          + New change order
        </PrimaryButton>
      </div>
    );
  }

  return (
    <Card>
      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Project
          </span>
          <select
            name="project_id"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.client_name ? ` (${p.client_name})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Title
          </span>
          <input
            name="title"
            required
            placeholder="Extra 4 feet of driveway"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Description
          </span>
          <textarea
            name="description"
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Scope of change, reason, materials affected…"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Additional cost ($)
          </span>
          <input
            name="additional_cost"
            type="number"
            step="0.01"
            defaultValue="0"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Additional days
          </span>
          <input
            name="additional_days"
            type="number"
            defaultValue="0"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-2 flex justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setOpen(false)}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </PrimaryButton>
        </div>
        {state?.ok === false && (
          <p className="md:col-span-2 text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </Card>
  );
}
