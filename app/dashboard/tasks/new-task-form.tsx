"use client";

import { useActionState, useState } from "react";
import { createTaskAction, type TaskActionResult } from "./actions";
import { PrimaryButton, SecondaryButton, Card } from "@/components/ui";

export function NewTaskForm({
  clients,
  projects,
  profiles,
}: {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; client_id: string | null }>;
  profiles: Array<{
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    TaskActionResult | null,
    FormData
  >(createTaskAction, null);
  const [clientId, setClientId] = useState<string>("");

  const projectOptions = clientId
    ? projects.filter((p) => p.client_id === clientId)
    : projects;

  if (!open) {
    return (
      <div>
        <PrimaryButton type="button" onClick={() => setOpen(true)}>
          + New task
        </PrimaryButton>
        {state?.ok === true && (
          <span className="ml-3 text-sm text-emerald-700">Task created.</span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Title
          </span>
          <input
            name="title"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="e.g. Order concrete for Rotella Ct"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="block text-xs font-medium text-neutral-600">
            Notes
          </span>
          <textarea
            name="body"
            rows={2}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Client
          </span>
          <select
            name="client_id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Project
          </span>
          <select
            name="project_id"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Assignee
          </span>
          <select
            name="assignee_id"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email} · {p.role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Priority
          </span>
          <select
            name="priority"
            defaultValue="normal"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Due date
          </span>
          <input
            name="due_at"
            type="date"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-neutral-600">
            Column
          </span>
          <select
            name="kanban_column"
            defaultValue="todo"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </label>
        <div className="sm:col-span-2 flex items-center justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setOpen(false)}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create task"}
          </PrimaryButton>
        </div>
        {state?.ok === false && (
          <p className="sm:col-span-2 text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </Card>
  );
}
