"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  uploadProjectPhoto,
  updateProjectPhoto,
  deleteProjectPhoto,
  sendToFinals,
  removeFromFinals,
  bulkSendToFinals,
} from "./photos-actions";
import { compressImage } from "@/lib/project-media/compress-client";
import {
  MEDIA_PHASES,
  MEDIA_PHASE_LABEL,
  type MediaPhase,
  type ProjectMedia,
} from "@/lib/project-media/types";

/**
 * Project photo panel — role-aware. Same component renders for admin/
 * office on the dashboard project page AND for crew on the crew PWA.
 *
 * Two surfaces, one component:
 *
 *   role="admin" / "office"
 *     - Top section: "Finals (shown on marketing site)" — the curated
 *       set that flows to the website. Photos in here have
 *       phase=after AND is_marketing_eligible=true.
 *     - Bottom section: "Job Photos (internal record)" — everything
 *       uploaded, including before/during/reference.
 *     - Per-photo: Send-to-Finals / Remove-from-Finals, Hero ★, edit
 *       alt text, delete.
 *     - Bulk select + "Send X to Finals" sticky toolbar.
 *     - Phase selector + "Use on marketing site" toggle visible.
 *
 *   role="crew"
 *     - Snap-and-upload only. No phase selector, no marketing toggle.
 *       Server enforces phase=during, is_marketing_eligible=false.
 *     - Shows the Finals section read-only so crew can see which of
 *       their photos made it onto the website.
 *     - Job Photos section read-only (just the grid, no per-photo
 *       actions).
 *
 * The two-section split gives admin a single page where they see both
 * "what the public sees" and "what we have on file." Crew never has to
 * think about marketing.
 */

type Role = "admin" | "office" | "crew";

type LocalState =
  | { kind: "idle" }
  | { kind: "uploading"; current: string; done: number; total: number }
  | { kind: "error"; message: string };

export function PhotosPanel({
  projectId,
  initial,
  role,
}: {
  projectId: string;
  initial: ProjectMedia[];
  role: Role;
}) {
  const [photos, setPhotos] = useState<ProjectMedia[]>(initial);
  const [state, setState] = useState<LocalState>({ kind: "idle" });
  // Default upload state. Crew never sees these but the server enforces
  // anyway — we still set them defensively in case a non-crew user
  // somehow gets the crew-style render.
  const [phase, setPhase] = useState<MediaPhase>(
    role === "crew" ? "during" : "after",
  );
  const [marketingDefault, setMarketingDefault] = useState(role !== "crew");
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isOffice = role === "admin" || role === "office";

  // Finals = marketing-eligible AND phase=after. Same filter the
  // marketing site uses, so this section is exactly "what's on the
  // website right now."
  const { finals, allPhotos } = useMemo(() => {
    const f = photos.filter(
      (p) => p.phase === "after" && p.is_marketing_eligible,
    );
    return { finals: f, allPhotos: photos };
  }, [photos]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setState({ kind: "error", message: "No image files in that drop." });
      return;
    }

    let done = 0;
    for (const original of list) {
      setState({
        kind: "uploading",
        current: original.name,
        done,
        total: list.length,
      });

      try {
        const compressed = await compressImage(original);
        const fd = new FormData();
        fd.set("file", compressed.file);
        fd.set("phase", phase);
        fd.set("is_marketing_eligible", String(marketingDefault));
        fd.set("width", String(compressed.width));
        fd.set("height", String(compressed.height));

        const res = await uploadProjectPhoto(projectId, fd);
        if (!res.ok) {
          setState({
            kind: "error",
            message: `${original.name}: ${res.error}`,
          });
          return;
        }
        // Newest first.
        setPhotos((prev) => [res.media, ...prev]);
        done++;
      } catch (err) {
        setState({
          kind: "error",
          message: `${original.name}: ${err instanceof Error ? err.message : "upload failed"}`,
        });
        return;
      }
    }

    setState({ kind: "idle" });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) void handleFiles(e.dataTransfer.files);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-5">
      {/* ─── Finals section ──────────────────────────────────────────── */}
      <FinalsSection
        photos={finals}
        role={role}
        onUpdated={(id, patch) =>
          setPhotos((prev) =>
            prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          )
        }
        onDeleted={(id) =>
          setPhotos((prev) => prev.filter((x) => x.id !== id))
        }
      />

      {/* ─── Upload + Job Photos section ─────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              Job Photos
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {role === "crew"
                ? "Snap photos as you work. The office reviews and picks which ones go on the marketing site."
                : "Internal record of every photo uploaded to this project. Promote the best ones to Finals (shown on marketing site)."}
            </p>
          </div>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
            {allPhotos.length}
          </span>
        </div>

        {/* Upload-options row — admin/office only. Crew gets a fixed
            "during" phase + private; the server enforces it regardless. */}
        {isOffice && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-neutral-600">Tag as</span>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as MediaPhase)}
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                {MEDIA_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {MEDIA_PHASE_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={marketingDefault}
                onChange={(e) => setMarketingDefault(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-neutral-700">
                Use on marketing site / social (only if also tagged
                &ldquo;After&rdquo;)
              </span>
            </label>
          </div>
        )}

        {/* Drop zone + native input */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
            dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-neutral-300 bg-neutral-50"
          }`}
        >
          <p className="text-sm text-neutral-600">
            {role === "crew"
              ? "Tap to take a photo or pick from your gallery."
              : "Drag photos here, or"}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <label className="cursor-pointer rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Choose photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={onChange}
              />
            </label>
            <label className="cursor-pointer rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              Take photo (camera)
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onChange}
              />
            </label>
          </div>
          {state.kind === "uploading" && (
            <p className="mt-3 text-xs text-brand-700">
              Uploading {state.current}… ({state.done + 1} / {state.total})
            </p>
          )}
          {state.kind === "error" && (
            <p className="mt-3 text-xs text-red-700">Error: {state.message}</p>
          )}
        </div>

        {/* Bulk-action toolbar — admin/office only, appears when ≥1 selected */}
        {isOffice && selected.size > 0 && (
          <BulkBar
            selectedIds={Array.from(selected)}
            onPromoted={(updatedCount, ids) => {
              setPhotos((prev) =>
                prev.map((p) =>
                  ids.includes(p.id)
                    ? {
                        ...p,
                        phase: "after",
                        is_marketing_eligible: true,
                      }
                    : p,
                ),
              );
              clearSelection();
              if (updatedCount === 0) {
                setState({
                  kind: "error",
                  message: "Bulk promote: nothing was updated.",
                });
              }
            }}
            onClear={clearSelection}
          />
        )}

        {/* Photo grid */}
        {allPhotos.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            {role === "crew"
              ? "No photos yet. Take some during the job — the office will pick the best ones for the website."
              : "No photos yet. Crew can upload from their phones in the field — same component, mobile-first."}
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allPhotos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                role={role}
                isSelected={selected.has(p.id)}
                onToggleSelect={() => toggleSelect(p.id)}
                onUpdated={(patch) =>
                  setPhotos((prev) =>
                    prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)),
                  )
                }
                onDeleted={() =>
                  setPhotos((prev) => prev.filter((x) => x.id !== p.id))
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Finals section ────────────────────────────────────────────────────

function FinalsSection({
  photos,
  role,
  onUpdated,
  onDeleted,
}: {
  photos: ProjectMedia[];
  role: Role;
  onUpdated: (id: string, patch: Partial<ProjectMedia>) => void;
  onDeleted: (id: string) => void;
}) {
  const isOffice = role === "admin" || role === "office";
  return (
    <section className="rounded-xl border-2 border-amber-300 bg-gradient-to-b from-amber-50/60 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            ★ Finals · Shown on marketing site
          </p>
          <h2 className="text-lg font-bold text-brand-900">
            What the public sees from this project
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            Photos here are <code>phase = after</code> and{" "}
            <code>is_marketing_eligible = true</code>. The home page,
            service pages, and area pages pull from this set automatically.
          </p>
        </div>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
          {photos.length}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-200 bg-white p-6 text-center text-sm text-neutral-600">
          {isOffice
            ? "No photos in Finals yet. Promote a photo from the Job Photos section below to start showing it on the marketing site."
            : "Nothing finalized yet. The office picks which photos go on the website."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              role={role}
              isFinalsView
              onUpdated={(patch) => onUpdated(p.id, patch)}
              onDeleted={() => onDeleted(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Bulk action toolbar ───────────────────────────────────────────────

function BulkBar({
  selectedIds,
  onPromoted,
  onClear,
}: {
  selectedIds: string[];
  onPromoted: (updatedCount: number, ids: string[]) => void;
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function promote() {
    setErr(null);
    startTransition(async () => {
      const res = await bulkSendToFinals(selectedIds);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      onPromoted(res.updated, selectedIds);
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3">
      <div>
        <p className="text-sm font-bold text-amber-900">
          {selectedIds.length} selected
        </p>
        {err && <p className="text-xs text-red-700">Error: {err}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={promote}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-bold text-amber-950 hover:bg-amber-600 disabled:opacity-60"
        >
          {pending
            ? "Promoting…"
            : `★ Send ${selectedIds.length} to Finals`}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ─── Photo card ────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  role,
  isFinalsView,
  isSelected,
  onToggleSelect,
  onUpdated,
  onDeleted,
}: {
  photo: ProjectMedia;
  role: Role;
  /** Renders inside the Finals section (slightly different chrome). */
  isFinalsView?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onUpdated: (patch: Partial<ProjectMedia>) => void;
  onDeleted: () => void;
}) {
  const isOffice = role === "admin" || role === "office";
  const isFinal =
    photo.phase === "after" && photo.is_marketing_eligible;

  const [editingAlt, setEditingAlt] = useState(false);
  const [altDraft, setAltDraft] = useState(photo.alt_text ?? "");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function patch(p: Partial<ProjectMedia>) {
    setErr(null);
    onUpdated(p);
    startTransition(async () => {
      const res = await updateProjectPhoto(photo.id, p);
      if (!res.ok) setErr(res.error);
    });
  }

  function saveAlt() {
    setEditingAlt(false);
    if (altDraft !== photo.alt_text) patch({ alt_text: altDraft });
  }

  function remove() {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deleteProjectPhoto(photo.id);
      if (!res.ok) setErr(res.error);
      else onDeleted();
    });
  }

  function promote() {
    setErr(null);
    onUpdated({ phase: "after", is_marketing_eligible: true });
    startTransition(async () => {
      const res = await sendToFinals(photo.id);
      if (!res.ok) setErr(res.error);
    });
  }

  function demote() {
    setErr(null);
    onUpdated({ is_marketing_eligible: false });
    startTransition(async () => {
      const res = await removeFromFinals(photo.id);
      if (!res.ok) setErr(res.error);
    });
  }

  return (
    <li
      className={`flex flex-col rounded-lg border bg-white shadow-sm ${
        isSelected
          ? "border-amber-500 ring-2 ring-amber-300"
          : isFinal
            ? "border-amber-200"
            : "border-neutral-200"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.public_url}
          alt={photo.alt_text ?? "Project photo"}
          loading="lazy"
          className="h-full w-full object-cover"
        />

        {/* Bulk-select checkbox — only in Job Photos view, only for office */}
        {isOffice && !isFinalsView && onToggleSelect && (
          <label className="absolute left-2 top-2 cursor-pointer rounded-md bg-white/90 px-1.5 py-1 shadow">
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 cursor-pointer accent-amber-500"
              aria-label="Select for bulk action"
            />
          </label>
        )}

        {/* Finals badge — visible on photos that are in Finals */}
        {isFinal && (
          <span
            className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 shadow"
            aria-label="Shown on marketing site"
          >
            ★ Finals
          </span>
        )}
        {!isFinal && !photo.is_marketing_eligible && (
          <span className="absolute right-2 top-2 rounded-full bg-neutral-700/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Internal
          </span>
        )}

        {photo.is_hero && (
          <span className="absolute bottom-2 right-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
            Hero
          </span>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          {MEDIA_PHASE_LABEL[photo.phase]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 text-xs">
        {/* Alt text — inline edit for office, read-only for crew */}
        {isOffice ? (
          editingAlt ? (
            <div>
              <textarea
                rows={2}
                value={altDraft}
                onChange={(e) => setAltDraft(e.target.value)}
                className="w-full rounded border border-neutral-300 p-1.5 text-xs"
                autoFocus
                onBlur={saveAlt}
              />
              <button
                type="button"
                onClick={saveAlt}
                className="mt-1 rounded bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingAlt(true)}
              className="text-left text-neutral-700 hover:text-brand-700"
              title="Click to edit alt text"
            >
              {photo.alt_text ?? (
                <em className="text-neutral-400">No alt text</em>
              )}
            </button>
          )
        ) : (
          <p className="text-neutral-700">
            {photo.alt_text ?? (
              <em className="text-neutral-400">No alt text</em>
            )}
          </p>
        )}

        {/* Action row — office only */}
        {isOffice && (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-1">
              {isFinal ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={demote}
                  title="Remove from Finals (stops appearing on the marketing site)"
                  className="rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                >
                  Remove from Finals
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={promote}
                  title="Promote to Finals (will appear on the marketing site)"
                  className="rounded bg-amber-500 px-2 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-600 disabled:opacity-60"
                >
                  ★ Send to Finals
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => patch({ is_hero: !photo.is_hero })}
                title={photo.is_hero ? "Unmark hero" : "Mark as hero"}
                className={`rounded px-2 py-1 text-xs font-bold transition ${
                  photo.is_hero
                    ? "bg-rose-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-rose-100"
                }`}
              >
                Hero
              </button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              title="Delete photo"
              className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              ✕
            </button>
          </div>
        )}

        {err && <p className="text-[10px] text-red-700">Error: {err}</p>}
      </div>
    </li>
  );
}
