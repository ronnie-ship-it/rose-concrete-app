"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ensureFormInstanceAction,
  saveFormInstanceAction,
  submitFormInstanceAction,
} from "./actions";

type Item = {
  key: string;
  label: string;
  type: "check" | "text" | "photo";
  required: boolean;
};

type Template = {
  id: string;
  name: string;
  kind: string | null;
  items: Item[];
  is_required_to_complete: boolean | null;
};

export function FormFiller({
  template,
  projectId,
  visitId,
}: {
  template: Template;
  projectId: string | null;
  visitId: string | null;
}) {
  const router = useRouter();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [pending, start] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    start(async () => {
      const res = await ensureFormInstanceAction(
        template.id,
        projectId,
        visitId,
      );
      if (!cancelled) {
        if (res.ok) setInstanceId(res.instanceId);
        else setError(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [template.id, projectId, visitId]);

  function set(key: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!instanceId) return;
    // Validate required items
    const missing = template.items.filter(
      (it) =>
        it.required &&
        (it.type === "check"
          ? !responses[it.key]
          : !(responses[it.key] as string | undefined)?.toString().trim()),
    );
    if (missing.length > 0) {
      setError(`Required: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setError(null);
    startSubmit(async () => {
      const res = await submitFormInstanceAction(instanceId, responses);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/crew"), 800);
      } else {
        setError(res.error);
      }
    });
  }

  async function saveDraft() {
    if (!instanceId) return;
    await saveFormInstanceAction(instanceId, responses);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        ✓ Submitted. Redirecting…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/crew" className="text-xs text-brand-700 underline">
        ← Today
      </Link>
      <h1 className="text-xl font-semibold text-neutral-900">{template.name}</h1>
      {pending && (
        <p className="text-xs text-neutral-500">Loading form…</p>
      )}
      <ul className="space-y-2">
        {template.items.map((it) => (
          <li
            key={it.key}
            className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
          >
            <label className="block">
              <span className="block text-sm font-medium text-neutral-800">
                {it.label}
                {it.required && (
                  <span className="ml-1 text-red-600">*</span>
                )}
              </span>
              {it.type === "check" && (
                <input
                  type="checkbox"
                  checked={Boolean(responses[it.key])}
                  onChange={(e) => set(it.key, e.target.checked)}
                  className="mt-2 h-5 w-5"
                />
              )}
              {it.type === "text" && (
                <textarea
                  value={(responses[it.key] as string) ?? ""}
                  onChange={(e) => set(it.key, e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              )}
              {it.type === "photo" && (
                <p className="mt-1 text-xs text-neutral-500">
                  Upload a photo via
                  {" "}
                  {projectId ? (
                    <a
                      className="underline"
                      href={`/crew/upload?project_id=${projectId}`}
                    >
                      crew upload
                    </a>
                  ) : (
                    "the upload page"
                  )}
                  .
                </p>
              )}
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 flex gap-2 border-t border-neutral-200 bg-white py-2">
        <button
          type="button"
          onClick={saveDraft}
          disabled={!instanceId || submitting}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!instanceId || submitting}
          className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
