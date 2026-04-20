import { LICENSE } from "@/lib/marketing/brand";
import { cn } from "@/lib/utils";

/**
 * Four trust badges that appear on every conversion-focused surface:
 * home hero, every service page, every landing page. Reads top-to-bottom
 * on phones, side-by-side on tablet+. Inline SVG icons keep this asset-
 * free (no font icons, no PNGs) for fast LCP.
 *
 * Variants:
 *   - default: full pill cards with icon + label, lives below hero
 *   - inline:  text-only divider list, lives in form footers and CTAs
 */

type Variant = "default" | "inline";

const BADGES = [
  { icon: "license", label: LICENSE, short: "Licensed" },
  { icon: "veteran", label: "Veteran-Owned", short: "Veteran-Owned" },
  { icon: "shield", label: "Fully Insured", short: "Insured" },
  { icon: "crew", label: "In-House Crew", short: "In-House" },
] as const;

export function TrustBadges({
  variant = "default",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <p
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-medium text-brand-700/80",
          className,
        )}
      >
        {BADGES.map((b, i) => (
          <span key={b.icon} className="flex items-center gap-2">
            <span aria-hidden="true">{i > 0 ? "·" : null}</span>
            {b.label}
          </span>
        ))}
      </p>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        className,
      )}
    >
      {BADGES.map((b) => (
        <li
          key={b.icon}
          className="flex items-center gap-3 rounded-lg border border-brand-100 bg-white px-3 py-3 shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
            <Icon name={b.icon} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-brand-900">
              {b.short}
            </p>
            <p className="truncate text-[11px] text-brand-700/70">{b.label}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Icon({ name }: { name: (typeof BADGES)[number]["icon"] }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  switch (name) {
    case "license":
      // Document-with-check
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      );
    case "veteran":
      // Star inside a shield
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8.5l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" />
        </svg>
      );
    case "shield":
      // Plain shield (insurance)
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "crew":
      // Two people
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
  }
}
