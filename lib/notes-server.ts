import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Note, NoteEntity } from "@/lib/notes";

/**
 * Server-only note loader. Kept separate from `lib/notes.ts` so client
 * components can import types/constants/utilities from `lib/notes`
 * without pulling in `next/headers`.
 */
export async function loadNotes(
  entityType: NoteEntity,
  entityId: string
): Promise<Note[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select(
      "id, entity_type, entity_id, kind, body, is_pinned, created_by, created_at, author:profiles!notes_created_by_fkey(full_name)"
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      kind: row.kind,
      body: row.body,
      is_pinned: row.is_pinned,
      created_by: row.created_by,
      created_at: row.created_at,
      author_name: author?.full_name ?? null,
    };
  });
}
