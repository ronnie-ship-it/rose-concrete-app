/**
 * Marketing-site queries for real project photos.
 *
 * Replaces the static placeholder data in `lib/marketing/projects.ts` for
 * any surface that wants real photos. Falls back gracefully when the
 * project_media table is empty (no rows yet) — callers render the
 * existing gradient ImageSlot placeholders in that case.
 *
 * Reads the `marketing_project_media` view (created in migration 033)
 * which JOINs project_media with projects + clients so service_type and
 * city are filterable in a single query.
 *
 * All functions:
 *   - Use the service-role Supabase client so the marketing site (which
 *     has no auth) can query without RLS getting in the way. Safe
 *     because the view only exposes is_marketing_eligible photos via
 *     the WHERE clauses below.
 *   - Filter is_marketing_eligible = true (the per-photo opt-out flag).
 *   - Filter project_status NOT IN ('lead', 'quoting', 'cancelled') —
 *     we only show photos from real, completed-or-active jobs.
 *   - Default to 'after' phase (the customer-facing hero shot).
 *   - Sort by sort_order then created_at desc so manually-promoted
 *     photos win, then newest.
 */

import { createServiceRoleClient } from "@/lib/supabase/service";
import type { MarketingProjectMedia } from "@/lib/project-media/types";

const COMPLETED_OR_ACTIVE = ["approved", "scheduled", "active", "done"];

/**
 * Photos for a given service type. Used by service detail pages and
 * service-area pages (when filtered down to projects in that area).
 */
export async function getProjectPhotos(
  serviceType: string,
  options: { limit?: number; phase?: "after" | "before" | "during" | "detail" } = {},
): Promise<MarketingProjectMedia[]> {
  const limit = Math.max(1, Math.min(50, options.limit ?? 6));
  const phase = options.phase ?? "after";

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_project_media")
    .select("*")
    .eq("is_marketing_eligible", true)
    .eq("phase", phase)
    .eq("service_type", serviceType)
    .in("project_status", COMPLETED_OR_ACTIVE)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!isExpectedMissingViewError(error)) {
      console.error("[marketing/project-photos] getProjectPhotos failed:", error);
    }
    return [];
  }
  return (data ?? []) as MarketingProjectMedia[];
}

/**
 * Photos for a given city slug. The slug is matched against `clients.city`
 * via a case-insensitive comparison after normalizing the slug back to
 * a display string ("national-city" → "National City").
 *
 * Falls back to ANY city's photos of the same service type if the city
 * has no photos yet — the marketing-area page can still show real work
 * even when we haven't poured in that exact city yet.
 */
export async function getAreaPhotos(
  citySlug: string,
  options: { limit?: number; serviceType?: string } = {},
): Promise<MarketingProjectMedia[]> {
  const limit = Math.max(1, Math.min(50, options.limit ?? 6));
  const cityDisplay = slugToCity(citySlug);

  const supabase = createServiceRoleClient();
  let q = supabase
    .from("marketing_project_media")
    .select("*")
    .eq("is_marketing_eligible", true)
    .eq("phase", "after")
    .ilike("client_city", cityDisplay)
    .in("project_status", COMPLETED_OR_ACTIVE);

  if (options.serviceType) q = q.eq("service_type", options.serviceType);

  const { data, error } = await q
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!isExpectedMissingViewError(error)) {
      console.error("[marketing/project-photos] getAreaPhotos failed:", error);
    }
    return [];
  }
  return (data ?? []) as MarketingProjectMedia[];
}

/**
 * Manually-promoted hero photos. Used by the home-page hero rotation
 * and as the fallback when no service-specific photos exist.
 */
export async function getHeroPhotos(
  options: { limit?: number } = {},
): Promise<MarketingProjectMedia[]> {
  const limit = Math.max(1, Math.min(20, options.limit ?? 6));
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_project_media")
    .select("*")
    .eq("is_marketing_eligible", true)
    .eq("is_hero", true)
    .in("project_status", COMPLETED_OR_ACTIVE)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isExpectedMissingViewError(error)) {
      console.error("[marketing/project-photos] getHeroPhotos failed:", error);
    }
    return [];
  }
  return (data ?? []) as MarketingProjectMedia[];
}

/**
 * Before/after pairs for a given service type. Returns projects that
 * have BOTH a `before` and an `after` photo, grouped by project_id.
 *
 * Used for the future "transformation" gallery. Returns up to `limit`
 * pairs.
 */
export async function getBeforeAfterPairs(
  serviceType: string,
  options: { limit?: number } = {},
): Promise<
  Array<{
    projectId: string;
    projectName: string | null;
    city: string | null;
    before: MarketingProjectMedia;
    after: MarketingProjectMedia;
  }>
> {
  const limit = Math.max(1, Math.min(20, options.limit ?? 6));
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_project_media")
    .select("*")
    .eq("is_marketing_eligible", true)
    .eq("service_type", serviceType)
    .in("phase", ["before", "after"])
    .in("project_status", COMPLETED_OR_ACTIVE)
    .order("created_at", { ascending: false })
    .limit(limit * 6); // overshoot — many projects only have one phase

  if (error) {
    if (!isExpectedMissingViewError(error)) {
      console.error(
        "[marketing/project-photos] getBeforeAfterPairs failed:",
        error,
      );
    }
    return [];
  }

  // Group by project. Only keep projects with both phases.
  const byProject = new Map<
    string,
    { before?: MarketingProjectMedia; after?: MarketingProjectMedia; meta: MarketingProjectMedia }
  >();
  for (const row of (data ?? []) as MarketingProjectMedia[]) {
    const slot = byProject.get(row.project_id) ?? { meta: row };
    if (row.phase === "before" && !slot.before) slot.before = row;
    if (row.phase === "after" && !slot.after) slot.after = row;
    byProject.set(row.project_id, slot);
  }

  const pairs: Array<{
    projectId: string;
    projectName: string | null;
    city: string | null;
    before: MarketingProjectMedia;
    after: MarketingProjectMedia;
  }> = [];
  for (const [projectId, slot] of byProject.entries()) {
    if (slot.before && slot.after) {
      pairs.push({
        projectId,
        projectName: slot.meta.project_name,
        city: slot.meta.client_city,
        before: slot.before,
        after: slot.after,
      });
      if (pairs.length >= limit) break;
    }
  }
  return pairs;
}

/**
 * Recent project headlines for the <RecentProjects /> component.
 * Returns up to `limit` projects (each with their hero/after photo)
 * with project name + city + relative date for the card overlay.
 *
 * Empty array → caller renders gradient placeholders from the existing
 * lib/marketing/projects.ts data.
 */
export async function getRecentProjectsForGallery(
  limit: number = 6,
): Promise<MarketingProjectMedia[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_project_media")
    .select("*")
    .eq("is_marketing_eligible", true)
    .eq("phase", "after")
    .in("project_status", COMPLETED_OR_ACTIVE)
    .order("is_hero", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit * 3); // overshoot — dedupe by project_id below

  if (error) {
    if (!isExpectedMissingViewError(error)) {
      console.error(
        "[marketing/project-photos] getRecentProjectsForGallery failed:",
        error,
      );
    }
    return [];
  }

  // One photo per project — the first (best-sorted) row wins.
  const seen = new Set<string>();
  const out: MarketingProjectMedia[] = [];
  for (const row of (data ?? []) as MarketingProjectMedia[]) {
    if (seen.has(row.project_id)) continue;
    seen.add(row.project_id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Recent-project gallery, filtered to one or more service types.
 *
 * Same shape as `getRecentProjectsForGallery` (overshoot, dedupe by
 * project_id, ordering) but adds a `service_type IN (...)` filter so
 * `/services/<slug>` pages can render only their own work.
 *
 * Empty `serviceTypes` returns []. We deliberately do NOT fall back to
 * the all-services query — that's exactly the bug we're fixing here.
 *
 * Accepts a single string or an array. Use the array form for combined
 * service pages (e.g. `walkways-sidewalks` covers
 * walkway + sidewalk + safe_sidewalks_program).
 */
export async function getRecentProjectsForService(
  serviceTypes: string | readonly string[],
  options: { limit?: number } = {},
): Promise<MarketingProjectMedia[]> {
  const limit = Math.max(1, Math.min(20, options.limit ?? 6));
  const types = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
  if (types.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("marketing_project_media")
    .select("*")
    .eq("is_marketing_eligible", true)
    .eq("phase", "after")
    .in("service_type", types)
    .in("project_status", COMPLETED_OR_ACTIVE)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit * 3); // overshoot — dedupe by project_id below

  if (error) {
    if (!isExpectedMissingViewError(error)) {
      console.error(
        "[marketing/project-photos] getRecentProjectsForService failed:",
        error,
      );
    }
    return [];
  }

  // One photo per project — first (best-sorted) row wins.
  const seen = new Set<string>();
  const out: MarketingProjectMedia[] = [];
  for (const row of (data ?? []) as MarketingProjectMedia[]) {
    if (seen.has(row.project_id)) continue;
    seen.add(row.project_id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Recognize the "view doesn't exist" Postgres error so we can stay
 * silent in build logs until migration 033 has been run. Any other
 * error (RLS, connection, etc.) still logs.
 *
 * Postgres error code 42P01 = undefined_table. Supabase surfaces it as
 * `{ code: '42P01', ... }` in the error object.
 */
function isExpectedMissingViewError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  // Postgres direct: 42P01 = undefined_table.
  if (e.code === "42P01") return true;
  // PostgREST (Supabase): PGRST205 = "Could not find the table in the schema cache".
  // PostgREST 204/205 cover the not-found family — match either.
  if (e.code === "PGRST205" || e.code === "PGRST204") return true;
  // Catch-all on the message text.
  if (
    e.message &&
    /marketing_project_media.* (does not exist|in the schema cache)/i.test(
      e.message,
    )
  ) {
    return true;
  }
  return false;
}

/** "national-city" → "National City". */
function slugToCity(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
