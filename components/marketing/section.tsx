import { cn } from "@/lib/utils";

/**
 * Standard section wrapper for marketing content blocks.
 *
 * Centralizes the page rhythm so every service / landing / area page
 * shares vertical padding, max-width, and heading typography. Pages
 * compose these instead of re-typing the same `<section><div>...` shell
 * over and over.
 *
 * Tones:
 *   - white  (default) — clean cards on white
 *   - cream            — subtle warm panel; alternates with white for
 *                        visual rhythm down a long landing page
 *   - brand            — navy panel with white type, used for callouts
 */

type Tone = "white" | "cream" | "brand";

const TONE_CLASSES: Record<Tone, string> = {
  white: "bg-white",
  cream: "bg-cream-50",
  brand: "bg-brand-900 text-white",
};

export function Section({
  id,
  tone = "white",
  className,
  children,
  "aria-labelledby": ariaLabelledBy,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  "aria-labelledby"?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "py-12 sm:py-16",
        // scroll-mt clears the sticky header when a #anchor jumps here.
        id ? "scroll-mt-20 sm:scroll-mt-24" : null,
        TONE_CLASSES[tone],
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
  id,
  tone = "default",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  id?: string;
  tone?: "default" | "inverse";
  className?: string;
}) {
  const titleColor =
    tone === "inverse" ? "text-white" : "text-brand-900";
  const subColor =
    tone === "inverse" ? "text-cream-50/80" : "text-brand-700/80";
  return (
    <header className={cn("mb-8 max-w-3xl sm:mb-10", className)}>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          {eyebrow}
        </p>
      )}
      <h2
        id={id}
        className={cn(
          "mt-1 text-3xl font-extrabold sm:text-4xl",
          titleColor,
        )}
      >
        {title}
      </h2>
      {sub && (
        <p className={cn("mt-2 text-base sm:text-lg", subColor)}>{sub}</p>
      )}
    </header>
  );
}
