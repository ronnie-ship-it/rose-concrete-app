"use client";

import { useActionState, useTransition } from "react";
import {
  createNote,
  togglePinNote,
  deleteNote,
  type NoteResult,
} from "@/app/dashboard/notes/actions";
import {
  NOTE_KINDS,
  NOTE_KIND_LABEL,
  timeAgo,
  type Note,
  type NoteEntity,
  type NoteKind,
} from "@/lib/notes";

/**
 * Reusable notes widget. Mount on any detail page with an entity
 * type+id and a pre-loaded list of notes. Pinned notes always sort
 * first; everything else is newest-first.
 */

export function NotesPanel({
  entityType,
  entityId,
  notes,
}: {
  entityType: NoteEntity;
  entityId: string;
  notes: Note[];
}) {
  const createBound = createNote.bind(null, entityType, entityId);
  const [state, formAction, pending] = useActionState<
    NoteResult | null,
    FormData
  >(createBound, null);

  const pinned = notes.filter((n) => n.is_pinned);
  const rest = notes.filter((n) => !n.is_pinned);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2">
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Add a note…"
          className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex items-center justify-between gap-3">
          <select
            name="kind"
            defaultValue="internal"
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs"
          >
            {NOTE_KINDS.map((k) => (
              <option key={k} value={k}>
                {NOTE_KIND_LABEL[k as NoteKind]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            {state?.ok === false && (
              <span className="text-xs text-red-700">{state.error}</span>
            )}
            {state?.ok === true && (
              <span className="text-xs text-emerald-700">Saved ✓</span>
            )}
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-neutral-500">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {pinned.map((n) => (
            <NoteRow key={n.id} note={n} pinnedSection />
          ))}
          {rest.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteRow({ note, pinnedSection }: { note: Note; pinnedSection?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li
      className={`rounded-md border p-3 ${
        pinnedSection
          ? "border-amber-300 bg-amber-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
            {NOTE_KIND_LABEL[note.kind]}
          </span>
          {note.is_pinned && <span className="text-amber-700">📌 pinned</span>}
          <span>{timeAgo(note.created_at)}</span>
          {note.author_name && <span>· {note.author_name}</span>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(() =>
                togglePinNote(
                  note.entity_type,
                  note.entity_id,
                  note.id,
                  !note.is_pinned
                )
              )
            }
            className="rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            {note.is_pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this note?")) return;
              start(() =>
                deleteNote(note.entity_type, note.entity_id, note.id)
              );
            }}
            className="rounded px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">
        {note.body}
      </p>
    </li>
  );
}
