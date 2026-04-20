import { buttonClassNames } from "@/components/ui/button";
import {
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";
import { cn } from "@/lib/utils";

/**
 * Closing CTA band. Lives at the bottom of every marketing page right
 * above the footer. The visitor has scrolled all the way down — they're
 * either ready to call, or about to leave. Big phone number + a "back
 * to the form" anchor for the lower-friction path.
 *
 * Visually loud (brand navy bg, white type, accent button) so it reads
 * as the page's "okay, decide now" moment.
 *
 * Props:
 *   - heading / sub:  page-specific copy (defaults are home-page-flavored)
 *   - formAnchorHref: where the secondary CTA scrolls to. Default '#quote'
 *                     matches the form anchor used on home + service +
 *                     landing pages.
 */

export function FinalCallCta({
  heading = "Ready to start? Let's talk.",
  sub = "Most quotes done same-week. Most jobs scheduled within two weeks of acceptance.",
  formAnchorHref = "#quote",
  className,
}: {
  heading?: string;
  sub?: string;
  formAnchorHref?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "bg-brand-900 text-white",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid items-center gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">{heading}</h2>
            <p className="mt-3 text-base text-cream-50/80 sm:text-lg">{sub}</p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <a
              href={PHONE_TEL_HREF}
              className="text-3xl font-extrabold text-white transition hover:text-accent-300 sm:text-4xl"
            >
              {PHONE_DISPLAY}
            </a>
            <p className="text-sm text-cream-50/70">7 days · 7am–7pm</p>
            <div className="flex flex-wrap gap-3">
              <a
                href={PHONE_TEL_HREF}
                className={buttonClassNames({ variant: "accent", size: "lg" })}
              >
                Call now
              </a>
              <a
                href={formAnchorHref}
                className={buttonClassNames({
                  variant: "outline",
                  size: "lg",
                  className:
                    "border-cream-50/30 bg-transparent text-white hover:border-accent-300 hover:bg-brand-800 hover:text-accent-300",
                })}
              >
                Get a free quote
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
