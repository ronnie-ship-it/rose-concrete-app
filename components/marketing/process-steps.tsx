import { cn } from "@/lib/utils";

/**
 * Numbered process steps. 3-5 entries per service so visitors get a
 * concrete (pun intended) sense of how the job actually goes. Renders
 * as a horizontal timeline at md+ and a stacked list on mobile.
 */

export type ProcessStep = {
  title: string;
  body: string;
};

export function ProcessSteps({
  steps,
  className,
}: {
  steps: readonly ProcessStep[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {steps.map((step, idx) => (
        <li
          key={step.title}
          className="relative flex flex-col rounded-xl border border-brand-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-500 text-lg font-extrabold text-brand-900">
            {idx + 1}
          </div>
          <h3 className="text-lg font-extrabold text-brand-900">
            {step.title}
          </h3>
          <p className="mt-2 text-sm text-brand-700/90">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
