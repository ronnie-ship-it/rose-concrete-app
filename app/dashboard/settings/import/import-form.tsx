"use client";

import { useRef, useState, useTransition } from "react";
import { previewImportAction } from "./actions";
import type { ImportResult, PreviewResult } from "./types";
import type { ImportKind } from "@/lib/jobber-import";

type ImportAction = (
  prev: ImportResult | null,
  fd: FormData
) => Promise<ImportResult>;

/**
 * Two-step importer: drag-and-drop → preview → commit. The file only
 * leaves the browser twice (once for preview, once for commit) so the
 * admin never commits something they didn't eyeball first.
 */
export function ImportForm({
  kind,
  label,
  commitAction,
  description,
}: {
  kind: ImportKind;
  label: string;
  commitAction: ImportAction;
  description: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setResult(null);
    if (f) runPreview(f);
  }

  function runPreview(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    startTransition(async () => {
      const r = await previewImportAction(kind, null, fd);
      setPreview(r);
    });
  }

  function runCommit() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const r = await commitAction(null, fd);
      setResult(r);
    });
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-brand-700">{label}</h3>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>

      {!file && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pickFile(f);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
            dragging
              ? "border-accent-400 bg-accent-50"
              : "border-neutral-300 bg-neutral-50 hover:border-brand-300"
          }`}
        >
          <span className="text-3xl">📄</span>
          <p className="mt-2 text-sm font-medium text-neutral-700">
            Drop CSV here, or click to choose
          </p>
          <p className="mt-1 text-xs text-neutral-500">Max 10 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {file && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-md bg-cream px-3 py-2 text-sm">
            <span className="truncate font-medium text-neutral-800">
              📎 {file.name}
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-neutral-600 underline"
            >
              Change
            </button>
          </div>

          {pending && !preview && !result && (
            <p className="text-xs text-neutral-500">Parsing preview…</p>
          )}

          {preview && preview.ok === false && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {preview.error}
            </p>
          )}

          {preview && preview.ok && !result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="Total rows" value={preview.total} />
                <Stat label="Valid" value={preview.valid} tone="good" />
                <Stat
                  label="Invalid"
                  value={preview.total - preview.valid}
                  tone={preview.total - preview.valid > 0 ? "warn" : undefined}
                />
              </div>

              <details
                className="rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs"
                open
              >
                <summary className="cursor-pointer font-semibold text-neutral-700">
                  First {preview.sample.length} mapped rows
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-neutral-700">
                  {JSON.stringify(preview.sample, null, 2)}
                </pre>
              </details>

              {preview.invalid.length > 0 && (
                <details className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-amber-800">
                    {preview.invalid.length} row
                    {preview.invalid.length === 1 ? "" : "s"} will be skipped
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {preview.invalid.map((i) => (
                      <li key={i.row} className="text-amber-900">
                        Row {i.row}: {i.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <button
                type="button"
                disabled={pending || preview.valid === 0}
                onClick={runCommit}
                className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {pending
                  ? "Importing…"
                  : `Import ${preview.valid} row${
                      preview.valid === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          )}

          {result && result.ok && (
            <div className="rounded-md bg-accent-50 p-3 text-xs text-neutral-800">
              <p className="font-semibold text-brand-700">
                ✓ Inserted {result.inserted} · Skipped {result.skipped}
              </p>
              {result.breakdown &&
                Object.values(result.breakdown).some((v) => v > 0) && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                    {result.breakdown.parent_missing > 0 && (
                      <span>
                        · Parent not found:{" "}
                        <strong>{result.breakdown.parent_missing}</strong>
                      </span>
                    )}
                    {result.breakdown.already_imported > 0 && (
                      <span>
                        · Already imported:{" "}
                        <strong>{result.breakdown.already_imported}</strong>
                      </span>
                    )}
                    {result.breakdown.duplicate_in_file > 0 && (
                      <span>
                        · Duplicate in file:{" "}
                        <strong>{result.breakdown.duplicate_in_file}</strong>
                      </span>
                    )}
                    {result.breakdown.mapper_invalid > 0 && (
                      <span>
                        · Bad row data:{" "}
                        <strong>{result.breakdown.mapper_invalid}</strong>
                      </span>
                    )}
                    {result.breakdown.db_error > 0 && (
                      <span className="text-red-700">
                        · DB rejected:{" "}
                        <strong>{result.breakdown.db_error}</strong>
                      </span>
                    )}
                    {result.breakdown.other > 0 && (
                      <span>
                        · Other: <strong>{result.breakdown.other}</strong>
                      </span>
                    )}
                  </div>
                )}
              {result.reasons.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-neutral-600 hover:underline">
                    {result.reasons.length} row message
                    {result.reasons.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px]">
                    {result.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                type="button"
                onClick={reset}
                className="mt-3 text-xs text-brand-700 underline"
              >
                Import another file
              </button>
            </div>
          )}

          {result && result.ok === false && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {result.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-green-700"
      : tone === "warn"
      ? "text-amber-700"
      : "text-neutral-800";
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
