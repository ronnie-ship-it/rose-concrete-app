import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ProjectForm } from "../project-form";
import { createProjectAction } from "../actions";

export const metadata = { title: "New project — Rose Concrete" };

type SearchParams = Promise<{ client_id?: string }>;

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { client_id } = await searchParams;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  if (!clients || clients.length === 0) {
    redirect("/dashboard/clients/new");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/projects"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">New project</h1>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <ProjectForm
          action={createProjectAction}
          clients={clients}
          initial={{ client_id: client_id ?? "", status: "lead" }}
          submitLabel="Create project"
        />
      </div>
    </div>
  );
}
