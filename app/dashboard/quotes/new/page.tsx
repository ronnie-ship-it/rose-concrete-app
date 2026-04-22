import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { NewQuoteForm } from "./form";

export const metadata = { title: "New quote — Rose Concrete" };

// Pre-existing project_id in the URL keeps the legacy "pick a project"
// flow (used by the project detail page's + Quote shortcut). Anything
// else redirects to Quick Quote so new quotes always start there.
type SearchParams = Promise<{
  project_id?: string;
  legacy?: string;
}>;

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { project_id, legacy } = await searchParams;

  // If the user came here without a pre-selected project and hasn't
  // opted into the legacy flow, send them to Quick Quote — it's
  // strictly faster for every case except "I'm starting from an
  // existing project".
  if (!project_id && legacy !== "1") {
    redirect("/dashboard/quotes/quick");
  }

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
        <p className="mt-1 text-sm text-neutral-600">
          Pick an existing project — or{" "}
          <Link
            href="/dashboard/quotes/quick"
            className="font-semibold text-brand-700 underline"
          >
            start a Quick Quote
          </Link>{" "}
          and we&apos;ll create the project for you.
        </p>
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
