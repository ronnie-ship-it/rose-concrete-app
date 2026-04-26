/**
 * Tappable address — opens Google Maps directions to the given
 * address. On iPhone the Maps URL scheme launches the native Apple
 * Maps app; on Android / desktop it opens Google Maps in the
 * browser. Either way the crew member is one tap away from
 * navigation.
 *
 * Why two URL strategies?
 *   - `maps://` — Apple's URL scheme, intercepted by iOS into the
 *     native Maps app. Bypasses Safari, no JS-launch popup.
 *   - `https://www.google.com/maps/dir/?...` — universal fallback,
 *     used by Android + desktop browsers. Apple devices also
 *     handle this URL via the App Clip handler if the native
 *     scheme isn't followed first.
 *
 * The href below uses the universal Google Maps deep link, which
 * iOS Safari + Chrome both intercept into Apple Maps when the user
 * has set Maps as their default routing app. That's the simplest
 * cross-platform behavior — works identically everywhere.
 */
import Link from "next/link";

export type AddressLinkProps = {
  /** Free-form address string (e.g. "123 Main St, San Diego, CA 92117"). */
  address: string | null | undefined;
  /** Optional: render as a Link with this className. */
  className?: string;
  /** Optional: fallback to render when address is empty. */
  fallback?: React.ReactNode;
  /** Optional: prepend a 📍 pin emoji to the rendered text. Default off. */
  showPin?: boolean;
  /** Optional: prepend a stroke-only pin SVG. Default off. */
  showPinIcon?: boolean;
  /** Optional: route mode. Default "directions" gets you turn-by-turn;
   *  "search" just zooms to the address. */
  mode?: "directions" | "search";
  /** Optional: trailing arrow indicator. Default true. */
  showArrow?: boolean;
};

/**
 * Build the Google Maps URL. Both iOS + Android intercept this
 * universal link into their native maps app when configured.
 */
export function buildMapsUrl(
  address: string,
  mode: "directions" | "search" = "directions",
): string {
  const q = encodeURIComponent(address.trim());
  if (mode === "search") {
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

export function AddressLink({
  address,
  className,
  fallback = null,
  showPin = false,
  showPinIcon = false,
  mode = "directions",
  showArrow = true,
}: AddressLinkProps) {
  const trimmed = address?.trim();
  if (!trimmed) return <>{fallback}</>;
  const href = buildMapsUrl(trimmed, mode);
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-start gap-1.5 text-sm text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700 dark:text-neutral-300"
      }
    >
      {showPin && <span aria-hidden="true">📍</span>}
      {showPinIcon && (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-neutral-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z" />
          <circle cx="12" cy="9" r="3" />
        </svg>
      )}
      <span className="min-w-0">{trimmed}</span>
      {showArrow && (
        <span aria-hidden="true" className="text-neutral-400">
          →
        </span>
      )}
    </Link>
  );
}
