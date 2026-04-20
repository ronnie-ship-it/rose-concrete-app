"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateAltText } from "@/lib/project-media/alt-text";
import {
  MEDIA_PHASES,
  type MediaPhase,
  type ProjectMedia,
} from "@/lib/project-media/types";

/**
 * Server actions for the project_media subsystem.
 *
 * Upload flow:
 *   1. Client compresses the image in the browser (canvas-based,
 *      max 2400px wide, JPEG quality ~0.82, target <500KB).
 *   2. Client uploads each compressed File via this `uploadProjectPhoto`
 *      action with FormData.
 *   3. Action puts the bytes into Storage at
 *      `project-media/projects/<project_id>/<uuid>.<ext>`.
 *   4. Action calls Anthropic Claude Vision API for alt text (best-
 *      effort; falls back to a sensible default if no API key or error).
 *   5. Action inserts the project_media row.
 *   6. revalidatePath() refreshes the project detail page.
 *
 * Mutations (`updateProjectPhoto`, `deleteProjectPhoto`,
 * `setHeroPhoto`) require admin/office. Crew can upload from the
 * field but can't edit or delete.
 */

const BUCKET = "project-media";

// Accept only the image formats Supabase Storage handles + browsers
// reliably render. HEIC is NOT in the list — iOS Safari converts to
// JPEG on selection in most cases, but we explicitly reject if it
// somehow slips through.
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB hard cap (matches storage policy)

export type UploadResult =
  | { ok: true; media: ProjectMedia; alt_source: "ai" | "fallback" }
  | { ok: false; error: string };

export async function uploadProjectPhoto(
  projectId: string,
  fd: FormData,
): Promise<UploadResult> {
  const user = await requireRole(["admin", "office", "crew"]);

  const file = fd.get("file") as File | null;
  if (!file || typeof file === "string") {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`,
    };
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Unsupported format ${file.type}. Use JPG, PNG, or WebP.`,
    };
  }

  // Defaults differ by role:
  //   admin/office  → phase=after, is_marketing_eligible=true (curated work)
  //   crew          → phase=during, is_marketing_eligible=false (defense in
  //                   depth — even if the client form is tampered with,
  //                   crew uploads can never go live without an admin
  //                   explicitly promoting them via "Send to Finals")
  const isCrewOnly = user.role === "crew";

  const phaseRaw = String(fd.get("phase") ?? (isCrewOnly ? "during" : "after"));
  const phaseFromForm = (MEDIA_PHASES as readonly string[]).includes(phaseRaw)
    ? (phaseRaw as MediaPhase)
    : isCrewOnly
      ? "during"
      : "after";
  // Crew can never set phase=after on upload. Anything they send in becomes
  // 'during' so it doesn't slip into the marketing query (which filters on
  // phase=after AND is_marketing_eligible=true).
  const phase: MediaPhase = isCrewOnly && phaseFromForm === "after"
    ? "during"
    : phaseFromForm;

  const eligibleFromForm =
    String(fd.get("is_marketing_eligible") ?? (isCrewOnly ? "false" : "true")) === "true";
  // Crew uploads always land non-marketing-eligible. Office promotes via
  // the dedicated server action below.
  const isMarketingEligible = isCrewOnly ? false : eligibleFromForm;
  const widthRaw = Number(fd.get("width"));
  const heightRaw = Number(fd.get("height"));
  const width = Number.isFinite(widthRaw) && widthRaw > 0 ? Math.round(widthRaw) : null;
  const height = Number.isFinite(heightRaw) && heightRaw > 0 ? Math.round(heightRaw) : null;

  // Build storage path. UUID-only filename in the bucket so original
  // filenames can collide without breaking anything.
  const ext = extFromMime(file.type);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `projects/${projectId}/${filename}`;

  // Use service-role client for the storage upload so we don't fight
  // RLS in cases where the auth context isn't perfectly threaded
  // through (e.g. crew PWA without a fresh session refresh).
  const service = createServiceRoleClient();
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await service.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: "31536000", // 1 year — file URLs are UUID-stable
      upsert: false,
    });
  if (uploadErr) {
    return { ok: false, error: `Storage upload failed: ${uploadErr.message}` };
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = pub.publicUrl;

  // Look up service_type for the alt-text prompt context.
  const auth = await createClient();
  const { data: project } = await auth
    .from("projects")
    .select("service_type, name")
    .eq("id", projectId)
    .maybeSingle();

  // Best-effort alt text. Never blocks the upload.
  const alt = await generateAltText(publicUrl, {
    serviceType: project?.service_type ?? null,
    phase,
    projectName: project?.name ?? null,
  });

  const { data: row, error: insertErr } = await service
    .from("project_media")
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      public_url: publicUrl,
      original_filename: file.name,
      mime_type: file.type,
      width,
      height,
      alt_text: alt.alt_text,
      phase,
      is_marketing_eligible: isMarketingEligible,
      uploaded_by: user.id,
    })
    .select("*")
    .single();
  if (insertErr || !row) {
    // Try to clean up the orphaned storage object — best-effort.
    await service.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: `DB insert failed: ${insertErr?.message ?? "unknown"}`,
    };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return {
    ok: true,
    media: row as ProjectMedia,
    alt_source: alt.source,
  };
}

export type UpdateMediaInput = Partial<{
  alt_text: string | null;
  caption: string | null;
  phase: MediaPhase;
  is_marketing_eligible: boolean;
  is_hero: boolean;
  sort_order: number;
}>;

export async function updateProjectPhoto(
  mediaId: string,
  patch: UpdateMediaInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  // Whitelist the patchable fields — never trust the client to set
  // project_id, storage_path, or anything else that could move the
  // photo to a different project. Null is allowed for alt_text/caption
  // so the user can clear them; truncate strings to safe lengths.
  const allowed: UpdateMediaInput = {};
  if (patch.alt_text === null) allowed.alt_text = null;
  else if (typeof patch.alt_text === "string") allowed.alt_text = patch.alt_text.slice(0, 280);
  if (patch.caption === null) allowed.caption = null;
  else if (typeof patch.caption === "string") allowed.caption = patch.caption.slice(0, 1000);
  if (patch.phase && (MEDIA_PHASES as readonly string[]).includes(patch.phase)) {
    allowed.phase = patch.phase;
  }
  if (typeof patch.is_marketing_eligible === "boolean") {
    allowed.is_marketing_eligible = patch.is_marketing_eligible;
  }
  if (typeof patch.is_hero === "boolean") allowed.is_hero = patch.is_hero;
  if (typeof patch.sort_order === "number" && Number.isFinite(patch.sort_order)) {
    allowed.sort_order = Math.round(patch.sort_order);
  }

  if (Object.keys(allowed).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("project_media")
    .select("project_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (fetchErr || !existing) {
    return { ok: false, error: "Media not found." };
  }

  const { error: updateErr } = await supabase
    .from("project_media")
    .update(allowed)
    .eq("id", mediaId);
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  revalidatePath(`/dashboard/projects/${existing.project_id}`);
  return { ok: true };
}

export async function deleteProjectPhoto(
  mediaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin", "office"]);
  const service = createServiceRoleClient();

  const { data: row } = await service
    .from("project_media")
    .select("storage_path, project_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Media not found." };

  // Storage delete first — orphaned DB row is recoverable, orphaned
  // storage object isn't (no DB record means no way to find it).
  const { error: storageErr } = await service.storage
    .from(BUCKET)
    .remove([row.storage_path]);
  if (storageErr) {
    // Continue anyway — we'd rather have an orphaned object than a
    // user-visible failure. Log it for the cleanup cron later.
    console.warn(
      "[project-media] storage delete failed (continuing with DB delete):",
      storageErr.message,
    );
  }

  const { error: dbErr } = await service
    .from("project_media")
    .delete()
    .eq("id", mediaId);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath(`/dashboard/projects/${row.project_id}`);
  return { ok: true };
}

/**
 * Promote a photo to "Finals" — the curated subset that flows to the
 * marketing site.
 *
 * Sets `phase = 'after'` AND `is_marketing_eligible = true` in one shot
 * — those are the exact two filters every marketing helper uses. A
 * single click is enough; no caption/alt-text refinement prompt yet
 * (admin can edit those inline before or after promoting).
 *
 * Admin/office only. Crew can upload but cannot promote — the whole
 * point of the Finals concept is that admin owns what goes public.
 */
export async function sendToFinals(
  mediaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("project_media")
    .select("project_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Media not found." };

  const { error } = await supabase
    .from("project_media")
    .update({ phase: "after", is_marketing_eligible: true })
    .eq("id", mediaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/projects/${existing.project_id}`);
  return { ok: true };
}

/**
 * Demote a photo from Finals — keeps the photo on the project but
 * stops it from appearing on the marketing site.
 *
 * Only flips `is_marketing_eligible = false`. Phase stays as-is so we
 * don't re-categorize a photo Ronnie already filed correctly. The
 * marketing query filters on BOTH flags, so flipping eligibility alone
 * is sufficient to remove from public surfaces.
 */
export async function removeFromFinals(
  mediaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("project_media")
    .select("project_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Media not found." };

  const { error } = await supabase
    .from("project_media")
    .update({ is_marketing_eligible: false })
    .eq("id", mediaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/projects/${existing.project_id}`);
  return { ok: true };
}

/**
 * Bulk promote — efficient end-of-job curation.
 *
 * Ronnie selects 5-10 photos at once after a project wraps and clicks
 * "Send to Finals". One UPDATE, one revalidate, one click.
 *
 * Returns the count of rows actually updated. Limited to 100 IDs per
 * call so a runaway bulk action can't update the whole table.
 */
export async function bulkSendToFinals(
  mediaIds: string[],
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  await requireRole(["admin", "office"]);
  if (mediaIds.length === 0) return { ok: true, updated: 0 };
  if (mediaIds.length > 100) {
    return { ok: false, error: "Too many photos in one batch (max 100)." };
  }
  const supabase = await createClient();

  // Look up project_id once so we know which page to revalidate. Bulk
  // promote is always within a single project — UI enforces it.
  const { data: rows } = await supabase
    .from("project_media")
    .select("project_id")
    .in("id", mediaIds);
  const projectIds = new Set((rows ?? []).map((r) => r.project_id as string));

  const { error, count } = await supabase
    .from("project_media")
    .update({ phase: "after", is_marketing_eligible: true }, { count: "exact" })
    .in("id", mediaIds);
  if (error) return { ok: false, error: error.message };

  for (const pid of projectIds) {
    revalidatePath(`/dashboard/projects/${pid}`);
  }
  return { ok: true, updated: count ?? 0 };
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}
