import { cn } from "@/lib/utils";

/**
 * "What's included" check-mark list. Used on every service + landing
 * page. Two columns at sm+ so even a long list reads in one screen.
 */
export function IncludedList({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <li key={it} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="text-base text-brand-800">{it}</span>
        </li>
      ))}
    </ul>
  );
}
