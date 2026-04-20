import { cn } from "@/lib/utils";

/**
 * FAQ accordion using native <details>/<summary>. Zero JS.
 *
 * The page wrapping this is responsible for emitting the matching
 * FAQPage JSON-LD via `faqJsonLd()` from lib/marketing/schema.ts so
 * Google can render the rich result.
 */

export type Faq = { q: string; a: string };

export function FaqSection({
  faqs,
  className,
}: {
  faqs: readonly Faq[];
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-brand-100 rounded-xl border border-brand-100 bg-white", className)}>
      {faqs.map((faq) => (
        <li key={faq.q}>
          <details className="group">
            <summary
              className={cn(
                "flex cursor-pointer items-start justify-between gap-4 px-5 py-4 text-left",
                "marker:hidden [&::-webkit-details-marker]:hidden",
                "hover:bg-brand-50/50",
              )}
            >
              <span className="text-base font-bold text-brand-900">
                {faq.q}
              </span>
              <span
                aria-hidden="true"
                className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition group-open:rotate-45 group-open:bg-accent-500 group-open:text-brand-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="h-3 w-3"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <div className="px-5 pb-5 text-sm leading-relaxed text-brand-700/90">
              {faq.a.split("\n\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : undefined}>
                  {para}
                </p>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
