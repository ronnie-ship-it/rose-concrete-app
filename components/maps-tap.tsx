"use client";

/**
 * `<MapsTap>` — a tappable address row that opens Maps and STOPS the
 * tap from bubbling up to a parent `<Link>` wrapper.
 *
 * Use this inside cards/list rows where the whole row is itself a
 * Link to a detail page — tapping the address should peel off and
 * launch Maps instead of following the parent link. Rendering a
 * regular `<a>` inside another anchor would be invalid HTML, so we
 * use a `<button>` styled like a link and call `window.open()`.
 */
import { buildMapsUrl } from "./address-link";

export function MapsTap({
  address,
  className,
  showPin = true,
  showArrow = false,
}: {
  address: string | null | undefined;
  className?: string;
  showPin?: boolean;
  showArrow?: boolean;
}) {
  const trimmed = address?.trim();
  if (!trimmed) return null;
  const href = buildMapsUrl(trimmed);
  return (
    <button
      type="button"
      onClick={(e) => {
        // Stop the parent Link from following its own href.
        e.preventDefault();
        e.stopPropagation();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      className={
        className ??
        "inline-flex max-w-full items-center gap-1 truncate text-left text-[11px] text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700 dark:text-neutral-400"
      }
    >
      {showPin && <span aria-hidden="true">📍</span>}
      <span className="truncate">{trimmed}</span>
      {showArrow && (
        <span aria-hidden="true" className="text-neutral-400">
          →
        </span>
      )}
    </button>
  );
}
