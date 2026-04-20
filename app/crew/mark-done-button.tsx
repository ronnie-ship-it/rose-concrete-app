"use client";

/**
 * "Mark complete" button with a photo-upload gate. Crew cannot
 * complete a visit until PHOTO_MIN (3) photos have been uploaded
 * on the project. Shows the live count and a direct upload link
 * when the count isn't there yet.
 */
import { useState, useTransition } from "react";
import { t } from "@/lib/i18n";
import type { LangPref } from "@/lib/preferences";

const PHOTO_MIN = 3;

export function MarkDoneButton({
  action,
  projectId,
  photoCount = 0,
  lang = "en",
}: {
  action: () => Promise<void>;
  projectId?: string;
  /** Current photo count on the project. Gate trips at < PHOTO_MIN. */
  photoCount?: number;
  lang?: LangPref;
}) {
  const [pending, start] = useTransition();
  const [warn, setWarn] = useState(false);

  const enough = photoCount >= PHOTO_MIN;

  function click() {
    if (!enough) {
      setWarn(true);
      return;
    }
    start(() => action());
  }

  const needed = Math.max(0, PHOTO_MIN - photoCount);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={click}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-bold text-white shadow-sm active:opacity-80 disabled:opacity-60 ${
          enough ? "bg-brand-600" : "bg-neutral-400 cursor-not-allowed"
        }`}
      >
        <span className="text-lg">✓</span>
        <span>{pending ? "…" : t(lang, "Mark complete")}</span>
      </button>
      {warn && !enough && (
        <span className="mt-1 text-center text-[11px] font-semibold text-red-600">
          {lang === "es"
            ? `Necesitas ${needed} foto${needed === 1 ? "" : "s"} más`
            : `Need ${needed} more photo${needed === 1 ? "" : "s"}`}
          {projectId && (
            <a
              href={`/crew/upload?project_id=${projectId}`}
              className="ml-1 underline"
            >
              {t(lang, "Upload")} →
            </a>
          )}
        </span>
      )}
    </div>
  );
}
