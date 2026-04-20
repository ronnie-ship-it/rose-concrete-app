/**
 * Photos-for-quote-PDF stub.
 *
 * Phase 2: when the quote-PDF generator is rebuilt, it'll embed
 * reference photos that the salesperson manually attached during quote
 * authoring. Today there's no quote_media table — this function returns
 * the project's existing photos as a starting set so the rebuild has
 * something to render against.
 *
 * The eventual table:
 *
 *   create table public.quote_media (
 *     quote_id   uuid references public.quotes(id) on delete cascade,
 *     media_id   uuid references public.project_media(id) on delete cascade,
 *     sort_order int default 0,
 *     primary key (quote_id, media_id)
 *   );
 *
 * Populated via a "Pick reference photos" UI on the new-quote form
 * that shows `getProjectPhotos(serviceType, { phase: 'after' })` for
 * the same service type as the project — i.e., "show me last month's
 * best driveway photos so I can pitch this homeowner."
 */

import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ProjectMedia } from "@/lib/project-media/types";

/**
 * Return reference photos for a quote.
 *
 * Today: returns all `is_marketing_eligible` photos from the quote's
 * project. When `quote_media` lands, this becomes a JOIN against the
 * link table instead.
 */
export async function getPhotosForQuote(
  quoteId: string,
): Promise<ProjectMedia[]> {
  if (!quoteId) return [];
  const supabase = createServiceRoleClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("project_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote?.project_id) return [];

  const { data, error } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", quote.project_id)
    .eq("is_marketing_eligible", true)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[quote-pdf/photos] getPhotosForQuote failed:", error);
    return [];
  }
  return (data ?? []) as ProjectMedia[];
}
