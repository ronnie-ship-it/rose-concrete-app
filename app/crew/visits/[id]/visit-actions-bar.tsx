"use client";

/**
 * Primary row of visit actions: [Start / Complete Visit] + [⋯].
 * Shows Start Visit while scheduled; Complete Visit while in_progress;
 * just a static "Visit completed" chip when done.
 *
 * The ⋯ overflow opens a bottom-sheet style drawer with: Reschedule,
 * Send invoice, Mark no-show. (Each is a link — we don't implement
 * the sheet actions inline; they jump to the office/admin surface.)
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { startVisitAction, completeVisitAction } from "./actions";

type Props = {
  visitId: string;
  projectId: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";
};

export function VisitActionsBar({ visitId, projectId, status }: Props) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);

  function onPrimary() {
    start(async () => {
      if (status === "scheduled") await startVisitAction(visitId);
      else if (status === "in_progress") await completeVisitAction(visitId);
    });
  }

  const primaryLabel =
    status === "completed"
      ? "Visit completed"
      : status === "in_progress"
        ? "Complete Visit"
        : "Start Visit";
  const primaryDisabled = pending || status === "completed" || status === "cancelled" || status === "no_show";

  return (
    <div className="relative flex items-stretch gap-2">
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#4A7C59] px-4 text-sm font-bold text-white shadow-sm active:opacity-90 disabled:bg-neutral-400"
      >
        {status === "completed" ? (
          <span className="text-lg">✓</span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {status === "in_progress" ? (
              <path d="M5 12l5 5 9-11" />
            ) : (
              <path d="M5 3l14 9-14 9V3z" />
            )}
          </svg>
        )}
        {pending ? "…" : primaryLabel}
      </button>
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-label="More actions"
        className="flex min-h-[48px] w-12 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm active:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      >
        <span className="text-xl leading-none">⋯</span>
      </button>
      {menu && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setMenu(false)}
          />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5 dark:bg-neutral-800">
            <MenuLink href={`/crew/upload?project_id=${projectId}`}>
              📷 Upload photos
            </MenuLink>
            <MenuLink href={`/crew/form?project_id=${projectId}`}>
              📋 Start a form
            </MenuLink>
            <MenuLink href={`/dashboard/schedule/${visitId}`}>
              📅 Reschedule
            </MenuLink>
            <MenuLink href={`/dashboard/projects/${projectId}`}>
              🧱 Open project
            </MenuLink>
          </div>
        </>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block border-b border-neutral-100 px-4 py-3 text-sm font-medium text-[#1a2332] last:border-0 active:bg-neutral-50 dark:border-neutral-700 dark:text-white"
    >
      {children}
    </Link>
  );
}
