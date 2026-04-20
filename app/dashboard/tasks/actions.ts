"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type TaskActionResult =
  | { ok: true }
  | { ok: false; error: string };

const KANBAN = ["todo", "in_progress", "review", "done"] as const;
export type KanbanColumn = (typeof KANBAN)[number];
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof PRIORITIES)[number];

export async function createTaskAction(
  _prev: TaskActionResult | null,
  fd: FormData,
): Promise<TaskActionResult> {
  try {
    await requireRole(["admin", "office"]);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Title is required." };
    const body = String(fd.get("body") ?? "").trim() || null;
    const clientId = String(fd.get("client_id") ?? "") || null;
    const projectId = String(fd.get("project_id") ?? "") || null;
    const assigneeId = String(fd.get("assignee_id") ?? "") || null;
    const dueAt = String(fd.get("due_at") ?? "") || null;
    const priority = PRIORITIES.includes(
      String(fd.get("priority") ?? "") as TaskPriority,
    )
      ? (String(fd.get("priority")) as TaskPriority)
      : "normal";
    const kanban = KANBAN.includes(
      String(fd.get("kanban_column") ?? "") as KanbanColumn,
    )
      ? (String(fd.get("kanban_column")) as KanbanColumn)
      : "todo";

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("tasks").insert({
      title,
      body,
      status: kanban === "done" ? "done" : "open",
      kanban_column: kanban,
      priority,
      client_id: clientId,
      project_id: projectId,
      assignee_id: assigneeId,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      source: "manual",
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create task.",
    };
  }
}

export async function updateTaskColumnAction(
  taskId: string,
  column: KanbanColumn,
  sortOrder: number,
): Promise<TaskActionResult> {
  try {
    await requireRole(["admin", "office"]);
    if (!KANBAN.includes(column)) {
      return { ok: false, error: "Invalid column." };
    }
    const supabase = createServiceRoleClient();
    const patch: Record<string, unknown> = {
      kanban_column: column,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    };
    if (column === "done") {
      patch.status = "done";
      patch.completed_at = new Date().toISOString();
    } else {
      patch.status = "open";
      patch.completed_at = null;
    }
    const { error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", taskId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/tasks");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update task.",
    };
  }
}

export async function updateTaskFieldsAction(
  taskId: string,
  patch: {
    title?: string;
    body?: string | null;
    assignee_id?: string | null;
    priority?: TaskPriority;
    due_at?: string | null;
  },
): Promise<TaskActionResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("tasks")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/tasks");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update task.",
    };
  }
}

export async function deleteTaskAction(
  taskId: string,
): Promise<TaskActionResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/tasks");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete task.",
    };
  }
}

/**
 * Seed the default task checklist from `task_templates` onto a specific
 * project. Called when a quote flips to accepted (see quote actions) and
 * also available as a manual "Seed checklist" action on the task board.
 */
export async function seedTasksForProjectAction(
  projectId: string,
  quoteId?: string | null,
): Promise<TaskActionResult> {
  try {
    await requireRole(["admin", "office"]);
    const supabase = createServiceRoleClient();
    const { data: templates, error: tErr } = await supabase
      .from("task_templates")
      .select("id, title, body, days_after, priority, sort_order")
      .eq("is_active", true)
      .eq("trigger", "quote_approved")
      .order("sort_order");
    if (tErr) return { ok: false, error: tErr.message };
    if (!templates || templates.length === 0) return { ok: true };

    // Pull the project's client so seeded tasks are linked.
    const { data: project } = await supabase
      .from("projects")
      .select("id, client_id")
      .eq("id", projectId)
      .maybeSingle();

    const { data: existing } = await supabase
      .from("tasks")
      .select("title")
      .eq("project_id", projectId)
      .eq("source", "quote_approved_template");
    const already = new Set(
      (existing ?? []).map((r) => r.title.toLowerCase().trim()),
    );

    const now = Date.now();
    const rows = templates
      .filter((t) => !already.has(t.title.toLowerCase().trim()))
      .map((t) => ({
        title: t.title,
        body: t.body,
        project_id: projectId,
        client_id: project?.client_id ?? null,
        priority: t.priority,
        kanban_column: "todo" as const,
        status: "open" as const,
        source: "quote_approved_template",
        source_id: quoteId ?? null,
        due_at: new Date(
          now + (t.days_after ?? 0) * 24 * 60 * 60 * 1000,
        ).toISOString(),
        sort_order: t.sort_order ?? 0,
      }));
    if (rows.length === 0) return { ok: true };
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to seed tasks.",
    };
  }
}
