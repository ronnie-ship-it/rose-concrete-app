import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { NewQuoteForm } from "./form";

export const metadata = { title: "New quote — Rose Concrete" };

type SearchParams = Promise<{ project_id?: string }>;

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { project_id } = await searchParams;

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client:clients(name)")
    .order("created_at", { ascending: false });

  if (!projects || projects.length === 0) {
    redirect("/dashboard/projects/new");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/dashboard/quotes"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Quotes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">New quote</h1>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <NewQuoteForm
          projects={projects.map((p) => {
            const c = p.client as
              | { name: string }
              | { name: string }[]
              | null
              | undefined;
            const client_name = Array.isArray(c)
              ? c[0]?.name ?? null
              : c?.name ?? null;
            return { id: p.id, name: p.name, client_name };
          })}
          defaultProjectId={project_id}
        />
      </div>
    </div>
  );
}
