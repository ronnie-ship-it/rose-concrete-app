import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Bottom-of-page cross-link block. Used on service / landing / area
 * pages to surface related routes — keeps internal-link graph healthy
 * for SEO and gives undecided visitors something to keep reading.
 */

export type RelatedLink = {
  href: string;
  title: string;
  sub?: string;
};

export function RelatedLinks({
  heading = "Keep reading",
  items,
  className,
}: {
  heading?: string;
  items: readonly RelatedLink[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn(className)}>
      <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
        {heading}
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="group block rounded-xl border border-brand-100 bg-white p-4 transition hover:border-accent-400 hover:shadow-md"
            >
              <p className="text-base font-bold text-brand-900 group-hover:text-accent-700">
                {it.title}
              </p>
              {it.sub && (
                <p className="mt-1 text-sm text-brand-700/80">{it.sub}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
