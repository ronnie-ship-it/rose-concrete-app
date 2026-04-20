import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { VisitForm } from "../visit-form";
import { createVisitAction } from "../actions";

export const metadata = { title: "New visit — Rose Concrete" };

type SearchParams = Promise<{ project_id?: string; date?: string }>;

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { project_id, date } = await searchParams;

  const supabase = await createClient();
  const [{ data: projects }, { data: crew }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client:clients(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["crew", "admin"])
      .order("full_name", { ascending: true }),
  ]);

  if (!projects || projects.length === 0) {
    redirect("/dashboard/projects/new");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/schedule"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Schedule
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">New visit</h1>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <VisitForm
          action={createVisitAction}
          projects={projects.map((p) => {
            const c = p.client as
              | { name: string }
              | { name: string }[]
              | null
              | undefined;
            return {
              id: p.id,
              name: p.name,
              client_name: Array.isArray(c)
                ? c[0]?.name ?? null
                : c?.name ?? null,
            };
          })}
          crew={crew ?? []}
          initial={{
            project_id: project_id ?? null,
            scheduled_for: date ? `${date}T08:00:00` : null,
          }}
          submitLabel="Create visit"
        />
      </div>
    </div>
  );
}
