"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  uploadAttachmentAction,
  deleteAttachmentAction,
  updateCaptionAction,
  type UploadResult,
} from "@/app/dashboard/attachments/actions";
import type {
  AttachmentEntity,
  AttachmentWithUrl,
} from "@/lib/attachments";

/**
 * Reusable files tray. Mount on any entity detail page with an
 * entity_type + entity_id and a pre-loaded list of attachments (with
 * signed URLs). Images render as thumbnails; everything else renders as
 * a filename row.
 *
 * Caption edit is optimistic only in the sense that the form submits and
 * the page revalidates — no client-side cache. Simplest thing that works.
 */
export function AttachmentsPanel({
  entityType,
  entityId,
  attachments,
  title = "Files",
}: {
  entityType: AttachmentEntity;
  entityId: string;
  attachments: AttachmentWithUrl[];
  title?: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [state, formAction, pending] = useActionState<
    UploadResult | null,
    FormData
  >(uploadAttachmentAction, null);
  const [dragActive, setDragActive] = useState(false);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </h2>
        <span className="text-xs text-neutral-400">
          {attachments.length} file{attachments.length === 1 ? "" : "s"}
        </span>
      </div>

      <form
        ref={formRef}
        action={formAction}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const dropped = e.dataTransfer?.files?.[0];
          if (dropped && fileRef.current) {
            const dt = new DataTransfer();
            dt.items.add(dropped);
            fileRef.current.files = dt.files;
            // Kick off submit immediately for drag-drop.
            formRef.current?.requestSubmit();
          }
        }}
        className={`rounded-md border border-dashed p-3 transition ${
          dragActive
            ? "border-brand-500 bg-brand-50"
            : "border-neutral-300 bg-white"
        }`}
      >
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            name="file"
            required
            className="block w-full flex-1 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-700"
            onChange={() => {
              // Auto-submit on pick so Ronnie doesn't hunt for an
              // "Upload" button — drag-drop does the same.
              formRef.current?.requestSubmit();
            }}
          />
          <input
            type="text"
            name="caption"
            placeholder="Caption (optional)"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs sm:w-48"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          Drag a file in or pick one. Photos, PDFs, anything up to 25 MB.
        </p>
        {state && !state.ok && (
          <p className="mt-2 text-xs text-red-700">{state.error}</p>
        )}
      </form>

      {attachments.length === 0 ? (
        <p className="mt-4 text-xs text-neutral-500">
          No files yet. Drop a permit, photo, or MOASURE screenshot above.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((a) => (
            <AttachmentCard key={a.id} attachment={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentCard({ attachment: a }: { attachment: AttachmentWithUrl }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(a.caption ?? "");

  return (
    <li className="overflow-hidden rounded-md border border-neutral-200 bg-white text-xs shadow-sm">
      <a
        href={a.signed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {a.is_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.signed_url}
            alt={a.caption ?? a.filename}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 items-center justify-center bg-neutral-50 text-3xl">
            📄
          </div>
        )}
      </a>
      <div className="space-y-1 p-2">
        <div className="truncate font-medium text-neutral-800" title={a.filename}>
          {a.filename}
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="flex-1 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
              autoFocus
            />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await updateCaptionAction(a.id, caption);
                  setEditing(false);
                })
              }
              className="rounded bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="block w-full truncate text-left text-[11px] text-neutral-500 hover:text-brand-700"
            title="Click to edit caption"
          >
            {a.caption ?? "(add caption)"}
          </button>
        )}
        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span>{formatBytes(a.size_bytes)}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete "${a.filename}"?`)) return;
              start(() => deleteAttachmentAction(a.id));
            }}
            className="font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
