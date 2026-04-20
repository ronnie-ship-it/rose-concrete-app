/**
 * Attachments — polymorphic file tray for any entity.
 *
 * Storage layout: `attachments/<entity_type>/<entity_id>/<uuid>-<filename>`.
 * The row in `public.attachments` is the source of truth; Storage is the
 * blob. Deletes cascade in userland (action deletes both, in that order).
 *
 * Signed-URL issuance uses the service-role client because the bucket is
 * private — the cookie-scoped client would need explicit Storage RLS that
 * matches the row RLS, and duplicating that in two places is fragile.
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

export type AttachmentEntity =
  | "client"
  | "project"
  | "quote"
  | "visit"
  | "task"
  | "permit";

export type Attachment = {
  id: string;
  entity_type: AttachmentEntity;
  entity_id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type AttachmentWithUrl = Attachment & {
  signed_url: string;
  is_image: boolean;
};

export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const IMAGE_MIME_PREFIX = "image/";

export function isImageMime(mime: string): boolean {
  return mime.startsWith(IMAGE_MIME_PREFIX);
}

export function storageKeyFor(
  entityType: AttachmentEntity,
  entityId: string,
  filename: string
): string {
  // UUID-ish prefix (crypto.randomUUID is fine in Node 18+).
  const id = crypto.randomUUID();
  // Keep the filename readable but strip anything that would break a URL
  // or path — Supabase Storage is relaxed about this but we don't want to
  // rely on that.
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${entityType}/${entityId}/${id}-${safe}`;
}

/**
 * Load attachments for one entity with fresh signed URLs. Use this in
 * server components — don't cache the result across requests since the
 * URLs expire.
 */
export async function loadAttachments(
  entityType: AttachmentEntity,
  entityId: string
): Promise<AttachmentWithUrl[]> {
  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[loadAttachments]", error);
    return [];
  }
  return await hydrateUrls((rows ?? []) as Attachment[]);
}

/**
 * Load attachments across many entities (e.g. the client page aggregates
 * every file attached to that client's projects + quotes). Keeps the
 * signed-URL minting to a single batched call per bucket.
 */
export async function loadAttachmentsAcross(
  entries: { entity_type: AttachmentEntity; entity_ids: string[] }[]
): Promise<AttachmentWithUrl[]> {
  const supabase = createServiceRoleClient();
  const or = entries
    .filter((e) => e.entity_ids.length > 0)
    .map(
      (e) =>
        `and(entity_type.eq.${e.entity_type},entity_id.in.(${e.entity_ids.join(
          ","
        )}))`
    )
    .join(",");
  if (!or) return [];
  const { data: rows, error } = await supabase
    .from("attachments")
    .select("*")
    .or(or)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[loadAttachmentsAcross]", error);
    return [];
  }
  return await hydrateUrls((rows ?? []) as Attachment[]);
}

async function hydrateUrls(
  rows: Attachment[]
): Promise<AttachmentWithUrl[]> {
  if (rows.length === 0) return [];
  const supabase = createServiceRoleClient();
  const { data: signed, error } = await supabase.storage
    .from("attachments")
    .createSignedUrls(
      rows.map((r) => r.storage_key),
      SIGNED_URL_TTL_SECONDS
    );
  if (error) {
    console.error("[hydrateUrls]", error);
    return [];
  }
  const byKey = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) byKey.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    ...r,
    signed_url: byKey.get(r.storage_key) ?? "",
    is_image: isImageMime(r.mime_type),
  }));
}
