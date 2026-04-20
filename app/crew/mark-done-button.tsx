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
    <div className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={click}
        className={`rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60 ${
          enough
            ? "bg-brand-600 hover:bg-brand-700"
            : "bg-neutral-400 cursor-not-allowed"
        }`}
      >
        {pending ? "…" : t(lang, "Mark complete")}
      </button>
      <span
        className={`mt-1 text-[11px] ${
          enough
            ? "text-neutral-500"
            : warn
              ? "text-red-600"
              : "text-amber-700"
        }`}
      >
        {enough
          ? `📷 ${photoCount} ${lang === "es" ? "fotos subidas" : "photos uploaded"} ✓`
          : lang === "es"
            ? `Necesitas ${needed} foto${needed === 1 ? "" : "s"} más (${photoCount}/${PHOTO_MIN}).`
            : `Need ${needed} more photo${needed === 1 ? "" : "s"} (${photoCount}/${PHOTO_MIN}).`}
        {!enough && projectId && (
          <a
            href={`/crew/upload?project_id=${projectId}`}
            className="ml-1 font-semibold underline"
          >
            {t(lang, "Upload")} →
          </a>
        )}
      </span>
    </div>
  );
}
