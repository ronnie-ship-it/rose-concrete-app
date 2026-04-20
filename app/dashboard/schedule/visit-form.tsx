"use client";

import { useActionState } from "react";
import type { VisitState } from "./actions";

type ProjectOption = { id: string; name: string; client_name: string | null };
type CrewOption = { id: string; full_name: string | null; email: string };

type VisitInitial = {
  project_id?: string | null;
  scheduled_for?: string | null;
  duration_min?: number | null;
  is_placeholder?: boolean | null;
  notes?: string | null;
  assigned_user_ids?: string[];
};

export function VisitForm({
  action,
  projects,
  crew,
  initial,
  submitLabel = "Save visit",
}: {
  action: (prev: VisitState, fd: FormData) => Promise<VisitState>;
  projects: ProjectOption[];
  crew: CrewOption[];
  initial?: VisitInitial;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  const scheduledLocal = initial?.scheduled_for
    ? toLocalInput(initial.scheduled_for)
    : "";

  const assigned = new Set(initial?.assigned_user_ids ?? []);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="project_id"
          className="block text-sm font-medium text-neutral-700"
        >
          Project *
        </label>
        <select
          id="project_id"
          name="project_id"
          required
          defaultValue={initial?.project_id ?? ""}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="scheduled_for"
            className="block text-sm font-medium text-neutral-700"
          >
            Date & time *
          </label>
          <input
            id="scheduled_for"
            name="scheduled_for"
            type="datetime-local"
            required
            defaultValue={scheduledLocal}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor="duration_min"
            className="block text-sm font-medium text-neutral-700"
          >
            Duration (minutes)
          </label>
          <input
            id="duration_min"
            name="duration_min"
            type="number"
            min="15"
            step="15"
            defaultValue={initial?.duration_min ?? 60}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <p className="block text-sm font-medium text-neutral-700">
          Assign crew
        </p>
        {crew.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">
            No crew users yet. Crew members appear here after they sign in once
            with their email.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {crew.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    name="assigned"
                    value={c.id}
                    defaultChecked={assigned.has(c.id)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{c.full_name ?? c.email}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="is_placeholder"
            defaultChecked={initial?.is_placeholder ?? false}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          Placeholder slot — rep will confirm with client before locking in
        </label>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-neutral-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
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
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function toLocalInput(iso: string): string {
  // Convert ISO timestamp to the local-time format <input type="datetime-local"> expects.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
