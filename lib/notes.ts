/**
 * Polymorphic notes — types, constants, and pure utilities used by both
 * `<NotesPanel>` (client) and server code. The server-only loader lives in
 * `lib/notes-server.ts` so this module stays safe to import from client
 * components.
 */

export type NoteEntity = "client" | "project" | "quote" | "visit";
export type NoteKind =
  | "call_note"
  | "site_visit"
  | "internal"
  | "customer_update";

export const NOTE_KINDS: NoteKind[] = [
  "internal",
  "call_note",
  "site_visit",
  "customer_update",
];

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  internal: "Internal",
  call_note: "Call note",
  site_visit: "Site visit",
  customer_update: "Customer update",
};

export type Note = {
  id: string;
  entity_type: NoteEntity;
  entity_id: string;
  kind: NoteKind;
  body: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  author_name?: string | null;
};

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(1, Math.round((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.round(d / 365);
  return `${y}y ago`;
}
