"use client";

import { useActionState } from "react";
import { createQuoteAction } from "../actions";

export function NewQuoteForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string; client_name: string | null }[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createQuoteAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="project_id"
          className="block text-sm font-medium text-neutral-700"
        >
          Project
        </label>
        <select
          id="project_id"
          name="project_id"
          required
          defaultValue={defaultProjectId ?? ""}
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="" disabled>
            Choose a project…
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.client_name ? ` — ${p.client_name}` : ""}
            </option>
          ))}
        </select>
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create quote"}
      </button>
    </form>
  );
}
