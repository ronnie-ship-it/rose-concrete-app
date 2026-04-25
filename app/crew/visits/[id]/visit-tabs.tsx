"use client";

/**
 * Two-tab switcher for the visit detail screen: "Visit Details" and
 * "Notes". Keeps tab state local to the client; no URL param because
 * there's nothing worth deep-linking to.
 *
 * Tab indicator is a 2px bottom-border that slides underneath the
 * selected label — Jobber mobile parity.
 */
import { useActionState, useState } from "react";
import { saveVisitNotesAction } from "./actions";

type Tab = "details" | "notes";

export function VisitTabs({
  detailsSlot,
  visitId,
  initialNotes,
}: {
  detailsSlot: React.ReactNode;
  visitId: string;
  initialNotes: string | null;
}) {
  const [tab, setTab] = useState<Tab>("details");
  return (
    <div>
      <div className="flex border-b border-neutral-200 dark:border-neutral-700">
        <TabButton active={tab === "details"} onClick={() => setTab("details")}>
          Visit Details
        </TabButton>
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
          Notes
        </TabButton>
      </div>
      <div className="mt-4">
        {tab === "details" ? (
          detailsSlot
        ) : (
          <NotesForm visitId={visitId} initialNotes={initialNotes} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 py-3 text-sm font-bold transition ${
        active
          ? "text-[#1a2332] dark:text-white"
          : "text-neutral-500 dark:text-neutral-400"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-[#1A7B40]" />
      )}
    </button>
  );
}

function NotesForm({
  visitId,
  initialNotes,
}: {
  visitId: string;
  initialNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveVisitNotesAction.bind(null, visitId),
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="notes"
        defaultValue={initialNotes ?? ""}
        placeholder="Add private notes about this visit — pour volume, site issues, follow-ups…"
        rows={8}
        className="w-full resize-y rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-sm focus:border-[#1A7B40] focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {state?.ok
            ? "Saved ✓"
            : state && !state.ok
              ? state.error
              : "Notes are visible only to your team."}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#1A7B40] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
      </div>
    </form>
  );
}
