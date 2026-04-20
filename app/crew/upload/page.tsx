import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { CrewUploader } from "./uploader";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";

export const metadata = { title: "Upload photos — Rose Concrete" };

type SearchParams = Promise<{ project_id?: string }>;

export default async function CrewUploadPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole(["crew"]);
  const { project_id } = await searchParams;
  const lang = await getLangPref();

  const supabase = await createClient();
  // Crew users only see projects they're scheduled to via RLS, so this list
  // is automatically scoped.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-neutral-900">
        {t(lang, "Upload a photo")}
      </h1>
      <p className="text-xs text-neutral-500">
        {lang === "es"
          ? "Las fotos entran a la biblioteca central y a la página del proyecto. Etiquétalas antes / durante / después para que la oficina las use en cotizaciones."
          : "Photos drop into the central library and the project page. Tag them before/during/after so the office can use them on quotes."}
      </p>
      <CrewUploader
        userId={user.id}
        projects={projects ?? []}
        defaultProjectId={project_id ?? null}
        lang={lang}
      />
    </div>
  );
}
