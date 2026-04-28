import Image from "next/image";
import { buttonClassNames } from "@/components/ui/button";
import { LeadForm } from "@/components/marketing/lead-form";
import { ImageSlot } from "@/components/marketing/image-slot";
import {
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";
import type { ServiceType } from "@/lib/service-types";
import { cn } from "@/lib/utils";

/**
 * Generic hero used by every service / landing / service-area page.
 *
 * Above-the-fold layout (mobile-first):
 *   [eyebrow]
 *   [BIG H1]
 *   [4-bullet trust line]
 *   [sub paragraph]
 *   [primary call CTA]   [secondary scroll-to-form CTA]   <- desktop side-by-side
 *   "Call or text within 1 hour — guaranteed"
 *
 *   ↓ on mobile this stacks. on desktop a right-column lead form sits beside.
 *
 * The form on the right is the default — the user lands on every page
 * with a form already visible above the fold (no scroll required).
 *
 * Pages can override the right column with `rightColumn` (e.g. for
 * pages that want to show a hero ImageSlot instead of a form), or pass
 * `formProps` to tune the embedded form.
 */

export type PageHeroProps = {
  eyebrow?: string;
  title: React.ReactNode;
  /** Optional secondary paragraph after the trust line. */
  sub?: React.ReactNode;
  /** Override the right column entirely. Defaults to <LeadForm>. */
  rightColumn?: React.ReactNode;
  /** Tune the embedded form when using the default right column. */
  formProps?: {
    eyebrow?: string;
    title?: string;
    defaultServiceType?: ServiceType | "";
  };
  /** Slot label for the fallback ImageSlot (only used if `rightColumn === "image"`). */
  imageSlot?: string;
  /** Headline overlay on the fallback ImageSlot. */
  imageHeadline?: string;
  /**
   * Optional decorative photo behind the entire hero section. Public-
   * folder path, e.g. `/images/hero-patio-hillside.jpg`. Defaults
   * undefined — when unset the hero renders the existing cream gradient
   * only (the original look on every other page that uses PageHero).
   *
   * When set, the photo sits at z-index -20 with `object-cover
   * object-center`. The existing cream gradient at z-index -10
   * continues to render on top of it as a translucent wash to protect
   * text contrast — text colors stay exactly as they are on every
   * other page.
   *
   * Marked `priority` because if a hero photo is set, it's the LCP
   * candidate. Empty alt because it's purely decorative.
   */
  backgroundImage?: string;
  /** @deprecated Legacy prop from earlier hero variant; accepted for
   *  backwards-compat and ignored. Pages that still pass
   *  `placeholderLabel` render the default right column. */
  placeholderLabel?: string;
  /** @deprecated Legacy prop used by the landing-page hero to force
   *  the secondary CTA to an anchor instead of "#quote". If null,
   *  the secondary CTA is hidden entirely. */
  formAnchorHref?: string | null;
  className?: string;
};

const TRUST_BULLETS = [
  "CA License #1130763",
  "Veteran-Owned",
  "Fully Insured",
  "No Subcontracting",
];

export function PageHero({
  eyebrow,
  title,
  sub,
  rightColumn,
  formProps,
  imageSlot,
  imageHeadline,
  backgroundImage,
  className,
}: PageHeroProps) {
  // Default right column = lead form (every page above-the-fold has a form).
  // Pages that want a photo placeholder pass `rightColumn={<ImageSlot ... />}`
  // or rely on `imageSlot`/`imageHeadline` shorthand.
  const right =
    rightColumn ??
    (imageSlot ? (
      <ImageSlot slot={imageSlot} headline={imageHeadline ?? "Rose Concrete"} />
    ) : (
      <div id="quote">
        <LeadForm
          defaultServiceType={formProps?.defaultServiceType ?? ""}
          eyebrow={formProps?.eyebrow ?? "Free · No obligation · 60 seconds"}
          title={formProps?.title ?? "Get Your Free Quote in 60 Seconds"}
        />
      </div>
    ));

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border-b border-brand-100 bg-cream-50",
        className,
      )}
    >
      {/* Optional decorative photo behind everything. Sits at -z-20
          (below the cream wash at -z-10) so the wash protects text
          contrast against a busy photo. */}
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
      )}
      {/* Cream wash. When `backgroundImage` is unset, this is just a
          subtle navy-to-cream gradient (the original look on every
          other page using PageHero). When `backgroundImage` IS set,
          the gradient stops shift to translucent rgba so the photo
          shows through underneath while protecting text contrast. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: backgroundImage
            ? "linear-gradient(180deg, rgba(245,239,224,0.88) 0%, rgba(253,251,245,0.85) 60%, rgba(255,255,255,0.82) 100%)"
            : "linear-gradient(180deg, #f5efe0 0%, #fdfbf5 60%, #ffffff 100%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-start gap-10 py-10 sm:py-14 md:grid-cols-2 md:gap-12 md:py-16">
          <div className="md:pt-2">
            {eyebrow && (
              <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
              {title}
            </h1>

            {/* Trust bullets — single line, dot-separated. */}
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-brand-800">
              {TRUST_BULLETS.map((b, i) => (
                <span key={b} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="text-accent-600">
                      ·
                    </span>
                  )}
                  {b}
                </span>
              ))}
            </p>

            {sub && (
              <div className="mt-5 text-base text-brand-700 sm:text-lg">
                {sub}
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={PHONE_TEL_HREF}
                className={buttonClassNames({
                  variant: "primary",
                  size: "xl",
                  className: "w-full sm:w-auto",
                })}
              >
                Call {PHONE_DISPLAY}
              </a>
              <a
                href="#quote"
                className={buttonClassNames({
                  variant: "outline",
                  size: "xl",
                  className: "w-full sm:w-auto",
                })}
              >
                Get a free quote →
              </a>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent-700">
              <span aria-hidden="true">⚡</span>
              Call or text within 1 hour — guaranteed.
            </p>
          </div>

          {/* Right column — form (default) or caller-supplied. */}
          <div>{right}</div>
        </div>
      </div>
    </section>
  );
}
