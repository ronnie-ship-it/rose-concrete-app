import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { TaskBoard } from "./task-board";
import { NewTaskForm } from "./new-task-form";

export const metadata = { title: "Tasks — Rose Concrete" };

type TaskRow = {
  id: string;
  title: string;
  body: string | null;
  kanban_column: "todo" | "in_progress" | "review" | "done";
  status: "open" | "done" | "dismissed";
  priority: "low" | "normal" | "high" | "urgent";
  sort_order: number;
  due_at: string | null;
  created_at: string;
  client_id: string | null;
  project_id: string | null;
  assignee_id: string | null;
  source: string | null;
};

export default async function TasksPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [{ data: tasksRaw }, { data: clientsRaw }, { data: projectsRaw }, { data: profilesRaw }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, body, kanban_column, status, priority, sort_order, due_at, created_at, client_id, project_id, assignee_id, source",
        )
        .neq("status", "dismissed")
        .order("kanban_column")
        .order("sort_order")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("projects").select("id, name, client_id").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name"),
    ]);

  const tasks = (tasksRaw ?? []) as TaskRow[];
  const clients = (clientsRaw ?? []) as Array<{ id: string; name: string }>;
  const projects = (projectsRaw ?? []) as Array<{
    id: string;
    name: string;
    client_id: string | null;
  }>;
  const profiles = (profilesRaw ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Kanban board for every to-do — drag cards between columns. Tasks auto-generate when a quote is approved."
      />

      <NewTaskForm
        clients={clients}
        projects={projects}
        profiles={profiles}
      />

      <TaskBoard
        tasks={tasks}
        clients={clients}
        projects={projects}
        profiles={profiles}
      />
    </div>
  );
}
