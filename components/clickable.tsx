import type { ReactNode } from "react";

/**
 * Centralized "make contact data tappable" helpers. Used everywhere a
 * phone, email, or address shows up so mobile users can dial/compose/map
 * with one tap and desktop users get the same link behavior for free.
 *
 * <Clickable kind="tel" value="619-555-0123" />
 * <Clickable kind="mail" value="ronnie@sandiegoconcrete.ai" />
 * <Clickable kind="map" value="123 Elm St, San Diego CA" />
 */

type Kind = "tel" | "mail" | "map";

function hrefFor(kind: Kind, value: string): string {
  if (kind === "tel") return `tel:${value.replace(/[^0-9+]/g, "")}`;
  if (kind === "mail") return `mailto:${value}`;
  // `kind === "map"` → directions URL. iOS + Android both intercept
  // this universal Google Maps link into the user's default Maps app
  // (Apple Maps if it's set as default; Google Maps otherwise). Using
  // the `dir/` path with `destination` puts the user on a turn-by-turn
  // directions screen, not a search result — closer to what crew want
  // when they tap an address from the field.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    value,
  )}&travelmode=driving`;
}

const ICON: Record<Kind, string> = {
  tel: "📞",
  mail: "✉️",
  map: "📍",
};

export function Clickable({
  kind,
  value,
  label,
  className,
  children,
}: {
  kind: Kind;
  value: string | null | undefined;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (!value) return null;
  const target = kind === "map" ? "_blank" : undefined;
  return (
    <a
      href={hrefFor(kind, value)}
      target={target}
      rel={target ? "noopener noreferrer" : undefined}
      className={
        className ??
        "inline-flex items-center gap-1 text-brand-700 hover:underline"
      }
    >
      <span aria-hidden>{ICON[kind]}</span>
      <span>{children ?? label ?? value}</span>
    </a>
  );
}

export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

export function composeAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): string | null {
  const joined = [
    parts.address,
    [parts.city, parts.state].filter(Boolean).join(", "),
    parts.postal_code,
  ]
    .filter(Boolean)
    .join(" ");
  return joined.trim() || null;
}
