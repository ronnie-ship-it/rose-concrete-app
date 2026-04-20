import Link from "next/link";
import { buttonClassNames } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * <TypicalCost /> — honest pricing context block.
 *
 * No exact quotes (that's what the lead form is for). Ranges + a clear
 * "what affects cost" list + an exit CTA back to the form. Lives on
 * every service and landing page.
 *
 * Props are content-shape-not-presentation so service/landing configs
 * can ship distinct cost copy without rewriting the section.
 */

export type TypicalCostProps = {
  /** Headline of the section, e.g. "What does a driveway replacement cost?" */
  heading: string;
  /** Range sentence — e.g. "Most San Diego driveway replacements run $8–$14 per square foot." */
  rangeSentence: string;
  /** Example sentence — typically a 1–2 sentence concrete example with totals. */
  exampleSentence: string;
  /** Bullet list of variables that affect the price. */
  factors: readonly string[];
  /** Anchor href for the "get an exact quote" CTA. */
  formAnchorHref?: string;
  className?: string;
};

export function TypicalCost({
  heading,
  rangeSentence,
  exampleSentence,
  factors,
  formAnchorHref = "#quote",
  className,
}: TypicalCostProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-100 bg-white p-6 shadow-sm sm:p-8",
        className,
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
        Cost · Honest ranges
      </p>
      <h2 className="mt-1 text-2xl font-extrabold text-brand-900 sm:text-3xl">
        {heading}
      </h2>
      <p className="mt-4 text-lg text-brand-800">{rangeSentence}</p>
      <p className="mt-2 text-base text-brand-700">{exampleSentence}</p>

      <div className="mt-6">
        <p className="text-sm font-bold text-brand-900">What affects cost:</p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {factors.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-brand-700">
              <span aria-hidden="true" className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-col items-start gap-2">
        <Link
          href={formAnchorHref}
          className={buttonClassNames({ variant: "primary", size: "lg" })}
        >
          Get your exact quote — free, no obligation →
        </Link>
        <p className="text-xs text-brand-700/70">
          Quotes are fixed-price. No change orders unless the scope changes.
        </p>
      </div>
    </div>
  );
}
