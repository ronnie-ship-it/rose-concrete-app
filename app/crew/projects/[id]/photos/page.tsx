import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PhotosPanel } from "@/app/dashboard/projects/[id]/photos-panel";
import type { ProjectMedia } from "@/lib/project-media/types";

/**
 * Crew-facing project photos page.
 *
 * Same `<PhotosPanel>` component the office uses, but mounted with
 * `role="crew"` — which:
 *   - Hides the phase selector and the "Use on marketing site" toggle.
 *   - Forces all uploads to phase=during, is_marketing_eligible=false
 *     (the server action enforces this regardless of the form, but the
 *     UI doesn't even surface the controls).
 *   - Hides the per-photo Send-to-Finals / Hero / Delete buttons.
 *   - Still shows the Finals section (read-only) so crew can see which
 *     of their photos the office promoted to the website.
 *
 * The crew PWA layout already gates the whole /crew/* tree to role=crew
 * via requireRole in app/crew/layout.tsx — this page is reachable from
 * any path the crew can navigate to (today's jobs, schedule, etc.).
 *
 * Direct URL: /crew/projects/<project_id>/photos
 *
 * RLS scopes the projects query to projects the crew is actually
 * assigned to, so a crew member can't browse arbitrary project IDs.
 */

export const metadata = { title: "Project photos — Rose Concrete" };

type Params = Promise<{ id: string }>;

export default async function CrewProjectPhotosPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["crew"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: photosRaw } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", id)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const photos = (photosRaw ?? []) as ProjectMedia[];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/crew"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Today
        </Link>
        <h1 className="mt-2 text-xl font-bold text-neutral-900">
          {project.name}
        </h1>
        <p className="text-xs text-neutral-500">
          Snap photos as you work. The office reviews and picks the best
          ones for the website. Don&apos;t worry about tagging — just
          shoot and upload.
        </p>
      </div>
      <PhotosPanel projectId={id} initial={photos} role="crew" />
    </div>
  );
}
