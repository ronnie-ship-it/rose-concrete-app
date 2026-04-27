/**
 * Shared row components used across the New X create flows. Two
 * shapes most commonly:
 *
 *   - `<ClientPickerRow>` — a tappable row that opens the client
 *     picker (`/crew/pick/client?ret=…`) and, when a client has been
 *     pre-filled via `?client_id=…` in the URL, renders the client's
 *     name + a hidden form input so the form action receives the ID.
 *
 *   - `<ProjectPickerRow>` — same shape for "Linked job" pickers.
 *
 *   - `<TeamPickerRow>` — same shape for "Team" pickers.
 *
 *   - `<NotYetAvailable>` — replaces the placeholder rows
 *     (image upload, line items, etc.) so taps don't crash. Renders
 *     a flat "Coming soon" label rather than a tappable button.
 */
import Link from "next/link";

function chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-neutral-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ClientPickerRow({
  ret,
  prefilled,
  inputName = "client_id",
  label = "Client",
}: {
  /** Path the picker should send the user back to. */
  ret: string;
  prefilled: { id: string; name: string } | null;
  /** Form input name we serialize the picked client_id under. */
  inputName?: string;
  label?: string;
}) {
  return (
    <Link
      href={`/crew/pick/client?ret=${encodeURIComponent(ret)}`}
      className="flex items-center gap-3 px-4 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-[#1A7B40]">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </p>
        <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
          {prefilled?.name ?? "Tap to pick a client"}
        </p>
      </div>
      {prefilled && (
        <input type="hidden" name={inputName} value={prefilled.id} />
      )}
      {chevron()}
    </Link>
  );
}

export function ProjectPickerRow({
  ret,
  prefilled,
  inputName = "project_id",
  label = "Linked job",
}: {
  ret: string;
  prefilled: { id: string; name: string } | null;
  inputName?: string;
  label?: string;
}) {
  return (
    <Link
      href={`/crew/pick/project?ret=${encodeURIComponent(ret)}`}
      className="flex items-center gap-3 px-4 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A7B40]/10 text-[#1A7B40]">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l4 4-2 2-1-1-7 7-2-2 7-7-1-1zM5 19l3-3 4 4-3 3a2 2 0 0 1-3-3l-1-1z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </p>
        <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
          {prefilled?.name ?? "Tap to link a job"}
        </p>
      </div>
      {prefilled && (
        <input type="hidden" name={inputName} value={prefilled.id} />
      )}
      {chevron()}
    </Link>
  );
}

export function TeamPickerRow({
  ret,
  prefilled,
  inputName = "user_id",
  label = "Team",
}: {
  ret: string;
  prefilled: { id: string; name: string } | null;
  inputName?: string;
  label?: string;
}) {
  return (
    <Link
      href={`/crew/pick/team?ret=${encodeURIComponent(ret)}`}
      className="flex items-center gap-3 px-4 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[#1a2332] dark:bg-neutral-700 dark:text-white">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 21c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5M14 21c0-2 2-3.5 4.5-3.5s4.5 1.5 4.5 3.5" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </p>
        <p className="truncate text-sm font-bold text-[#1a2332] dark:text-white">
          {prefilled?.name ?? "Tap to assign team"}
        </p>
      </div>
      {prefilled && (
        <input type="hidden" name={inputName} value={prefilled.id} />
      )}
      {chevron()}
    </Link>
  );
}

/**
 * Visual placeholder for a section that's not wired up yet. Renders
 * the section header + a faint "Coming soon" line so taps don't
 * crash and the user understands what's happening.
 */
export function NotYetAvailable({
  label,
  sublabel,
}: {
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-400 dark:text-neutral-500">
          {label}
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          Coming soon
        </span>
      </div>
      {sublabel && (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {sublabel}
        </p>
      )}
    </div>
  );
}
