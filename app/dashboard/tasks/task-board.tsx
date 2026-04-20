"use client";

import { useState, useTransition } from "react";
import {
  deleteTaskAction,
  updateTaskColumnAction,
  updateTaskFieldsAction,
  type KanbanColumn,
  type TaskPriority,
} from "./actions";

type TaskRow = {
  id: string;
  title: string;
  body: string | null;
  kanban_column: KanbanColumn;
  status: "open" | "done" | "dismissed";
  priority: TaskPriority;
  sort_order: number;
  due_at: string | null;
  created_at: string;
  client_id: string | null;
  project_id: string | null;
  assignee_id: string | null;
  source: string | null;
};

const COLUMNS: { id: KanbanColumn; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const priorityStyle: Record<TaskPriority, string> = {
  low: "bg-neutral-100 text-neutral-700",
  normal: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

function dueBadge(due: string | null): {
  label: string;
  tone: "neutral" | "warn" | "overdue";
} | null {
  if (!due) return null;
  const dueTime = new Date(due).getTime();
  if (Number.isNaN(dueTime)) return null;
  const diff = dueTime - Date.now();
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  const label =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days > 0
          ? `In ${days}d`
          : `${Math.abs(days)}d overdue`;
  const tone = days < 0 ? "overdue" : days <= 1 ? "warn" : "neutral";
  return { label, tone };
}

export function TaskBoard({
  tasks: initialTasks,
  clients,
  projects,
  profiles,
}: {
  tasks: TaskRow[];
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; client_id: string | null }>;
  profiles: Array<{
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  }>;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeEdit, setActiveEdit] = useState<string | null>(null);

  const clientById = new Map(clients.map((c) => [c.id, c.name]));
  const projectById = new Map(projects.map((p) => [p.id, p.name]));
  const profileById = new Map(
    profiles.map((p) => [p.id, p.full_name ?? p.email]),
  );

  function moveTo(taskId: string, column: KanbanColumn) {
    setTasks((prev) => {
      const colCount = prev.filter(
        (t) => t.kanban_column === column && t.id !== taskId,
      ).length;
      return prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              kanban_column: column,
              sort_order: colCount,
              status: column === "done" ? "done" : "open",
            }
          : t,
      );
    });
    startTransition(async () => {
      const snapshot = tasks.filter(
        (t) => t.kanban_column === column && t.id !== taskId,
      );
      await updateTaskColumnAction(taskId, column, snapshot.length);
    });
  }

  function onDragStart(
    e: React.DragEvent<HTMLDivElement>,
    taskId: string,
  ): void {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  }

  function onDropColumn(
    e: React.DragEvent<HTMLDivElement>,
    column: KanbanColumn,
  ) {
    e.preventDefault();
    const taskId = dragId ?? e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    moveTo(taskId, column);
    setDragId(null);
  }

  function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await deleteTaskAction(taskId);
    });
  }

  function updateFields(
    taskId: string,
    patch: {
      title?: string;
      body?: string | null;
      assignee_id?: string | null;
      priority?: TaskPriority;
      due_at?: string | null;
    },
  ) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    );
    startTransition(async () => {
      await updateTaskFieldsAction(taskId, patch);
    });
  }

  const grouped: Record<KanbanColumn, TaskRow[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };
  for (const t of tasks) grouped[t.kanban_column].push(t);

  return (
    <div className="relative">
      {isPending && (
        <span className="pointer-events-none absolute right-0 top-0 text-xs text-neutral-500">
          Saving…
        </span>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.id];
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropColumn(e, col.id)}
              className="flex min-h-[200px] flex-col rounded-lg border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-800">
                  {col.label}
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600 border border-neutral-200">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((t) => {
                  const due = dueBadge(t.due_at);
                  const isEditing = activeEdit === t.id;
                  return (
                    <div
                      key={t.id}
                      draggable={!isEditing}
                      onDragStart={(e) => onDragStart(e, t.id)}
                      className={`rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm transition ${
                        isEditing ? "ring-2 ring-brand-400" : "cursor-grab"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {isEditing ? (
                          <input
                            defaultValue={t.title}
                            onBlur={(e) => {
                              if (e.target.value.trim() !== t.title) {
                                updateFields(t.id, { title: e.target.value.trim() });
                              }
                            }}
                            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm font-medium"
                          />
                        ) : (
                          <p className="flex-1 font-medium text-neutral-900">
                            {t.title}
                          </p>
                        )}
                        <span
                          className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityStyle[t.priority]}`}
                        >
                          {t.priority}
                        </span>
                      </div>
                      {t.body && !isEditing && (
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                          {t.body}
                        </p>
                      )}
                      {isEditing && (
                        <textarea
                          defaultValue={t.body ?? ""}
                          rows={2}
                          onBlur={(e) => {
                            const next = e.target.value.trim() || null;
                            if (next !== (t.body ?? null)) {
                              updateFields(t.id, { body: next });
                            }
                          }}
                          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                        />
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-neutral-600">
                        {t.client_id && clientById.get(t.client_id) && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                            {clientById.get(t.client_id)}
                          </span>
                        )}
                        {t.project_id && projectById.get(t.project_id) && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                            {projectById.get(t.project_id)}
                          </span>
                        )}
                        {t.assignee_id && profileById.get(t.assignee_id) && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">
                            @{profileById.get(t.assignee_id)}
                          </span>
                        )}
                        {due && (
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              due.tone === "overdue"
                                ? "bg-red-100 text-red-800"
                                : due.tone === "warn"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {due.label}
                          </span>
                        )}
                      </div>
                      {isEditing && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <label>
                            <span className="block text-[10px] text-neutral-500">
                              Assignee
                            </span>
                            <select
                              defaultValue={t.assignee_id ?? ""}
                              onChange={(e) =>
                                updateFields(t.id, {
                                  assignee_id: e.target.value || null,
                                })
                              }
                              className="w-full rounded border border-neutral-300 px-1 py-0.5"
                            >
                              <option value="">—</option>
                              {profiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name ?? p.email}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="block text-[10px] text-neutral-500">
                              Priority
                            </span>
                            <select
                              defaultValue={t.priority}
                              onChange={(e) =>
                                updateFields(t.id, {
                                  priority: e.target.value as TaskPriority,
                                })
                              }
                              className="w-full rounded border border-neutral-300 px-1 py-0.5"
                            >
                              <option value="low">Low</option>
                              <option value="normal">Normal</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </label>
                          <label className="col-span-2">
                            <span className="block text-[10px] text-neutral-500">
                              Due date
                            </span>
                            <input
                              type="date"
                              defaultValue={
                                t.due_at ? t.due_at.slice(0, 10) : ""
                              }
                              onBlur={(e) =>
                                updateFields(t.id, {
                                  due_at: e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : null,
                                })
                              }
                              className="w-full rounded border border-neutral-300 px-1 py-0.5"
                            />
                          </label>
                        </div>
                      )}
                      <div className="mt-2 flex justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveEdit(isEditing ? null : t.id)
                          }
                          className="text-brand-700 hover:underline"
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="rounded border border-dashed border-neutral-300 bg-white p-3 text-center text-xs text-neutral-400">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
