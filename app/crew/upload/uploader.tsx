"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordPhotoAction } from "./actions";
import type { LangPref } from "@/lib/preferences";

type ProjectOption = { id: string; name: string };

const TAG_OPTIONS = ["before", "during", "after", "driveway", "patio", "stamped"];

// Locally-defined tag + copy labels per language. Keeps the
// component self-contained instead of dragging these strings into
// lib/i18n (where they'd live forever even if we retire them).
const COPY: Record<LangPref, Record<string, string>> = {
  en: {
    project: "Project",
    noProject: "— Library (no project) —",
    tag: "Tag",
    caption: "Caption (optional)",
    tap: "Tap to take or choose photos",
    multiple: "Multiple at once is fine",
    uploading: "Uploading",
    recent: "Recently uploaded",
  },
  es: {
    project: "Proyecto",
    noProject: "— Biblioteca (sin proyecto) —",
    tag: "Etiqueta",
    caption: "Descripción (opcional)",
    tap: "Toca para tomar o elegir fotos",
    multiple: "Puedes subir varias",
    uploading: "Subiendo",
    recent: "Subidas recientes",
  },
};
const TAG_LABELS_ES: Record<string, string> = {
  before: "antes",
  during: "durante",
  after: "después",
  driveway: "entrada",
  patio: "patio",
  stamped: "estampado",
};

export function CrewUploader({
  userId,
  projects,
  defaultProjectId,
  lang = "en",
}: {
  userId: string;
  projects: ProjectOption[];
  defaultProjectId: string | null;
  lang?: LangPref;
}) {
  const copy = COPY[lang];
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [tag, setTag] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: fileList.length });
    const supabase = createClient();
    const uploaded: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${
        projectId ? `projects/${projectId}` : "library"
      }/${userId}/${Date.now()}-${i}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (upErr) {
        setError(upErr.message);
        setBusy(false);
        return;
      }

      const fd = new FormData();
      fd.set("storage_key", path);
      if (projectId) fd.set("project_id", projectId);
      if (tag) fd.set("tags", tag);
      if (caption) fd.set("caption", caption);
      const result = await recordPhotoAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      uploaded.push(file.name);
      setProgress({ done: i + 1, total: fileList.length });
    }

    setRecent((prev) => [...uploaded, ...prev].slice(0, 12));
    setBusy(false);
    setProgress(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700">
          {copy.project}
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">{copy.noProject}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">
          {copy.tag}
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tagKey) => (
            <button
              key={tagKey}
              type="button"
              onClick={() => setTag((prev) => (prev === tagKey ? "" : tagKey))}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tag === tagKey
                  ? "bg-brand-600 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700"
              }`}
            >
              {lang === "es" ? TAG_LABELS_ES[tagKey] ?? tagKey : tagKey}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">
          {copy.caption}
        </label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-10 text-center text-sm text-brand-700">
        <span className="text-3xl">📷</span>
        <span className="mt-2 font-semibold">{copy.tap}</span>
        <span className="mt-1 text-xs text-neutral-500">{copy.multiple}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {progress && (
        <p className="text-xs text-neutral-600">
          {copy.uploading} {progress.done} / {progress.total}…
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {recent.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
          <p className="font-semibold">{copy.recent}</p>
          <ul className="mt-1 space-y-0.5">
            {recent.map((name, i) => (
              <li key={`${name}-${i}`}>✓ {name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
