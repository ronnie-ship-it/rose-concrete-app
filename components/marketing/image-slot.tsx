import { cn } from "@/lib/utils";

/**
 * Finished-looking placeholder for a future photo. Renders a brand-navy
 * gradient with subtle noise texture (SVG turbulence in a CSS data URL,
 * no asset deps) and an overlay typography block. Reads as an
 * intentional design element, not a broken image.
 *
 * Ronnie drops a real photo by:
 *   1. Saving it to /public/marketing/<filename>
 *   2. Replacing <ImageSlot> with <Image src="/marketing/<filename>" ... />
 *      where the slot lives. Each slot exposes a `slot` prop that doubles
 *      as the filename hint (rendered into a dev-only HTML comment + the
 *      visible label).
 *
 * Design intent:
 *   - Navy → almost-black radial gradient gives depth without color noise
 *   - SVG turbulence noise overlay adds film-grain "real photo" quality
 *   - Accent-teal corner stripe + slot label sit in the bottom-left
 *   - Big overlay headline sits center-left
 */

const NOISE_SVG = encodeURIComponent(
  `<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)' opacity='0.45'/>` +
    `</svg>`,
);
const NOISE_DATA_URL = `url("data:image/svg+xml,${NOISE_SVG}")`;

type Aspect = "square" | "video" | "wide" | "portrait" | "hero";

const ASPECT_CLASSES: Record<Aspect, string> = {
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[16/9]",
  portrait: "aspect-[3/4]",
  hero: "aspect-[4/3]",
};

export type ImageSlotProps = {
  /**
   * Suggested filename for the eventual photo. Doubles as the visible
   * label in the slot ("driveway-replacement-clairemont.jpg" etc).
   */
  slot: string;
  /** Big overlay headline — usually the service or project name. */
  headline?: string;
  /** Smaller line above the headline. */
  eyebrow?: string;
  aspect?: Aspect;
  /** Optional subtle accent bar position. */
  accent?: "bottom" | "left" | "none";
  className?: string;
};

export function ImageSlot({
  slot,
  headline,
  eyebrow,
  aspect = "hero",
  accent = "bottom",
  className,
}: ImageSlotProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl",
        ASPECT_CLASSES[aspect],
        className,
      )}
      // Dev-only HTML comment so source-view shows the swap target clearly.
      data-image-slot={slot}
    >
      {/* Brand navy radial gradient. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 0% 0%, #2d416f 0%, #1B2A4A 38%, #0a0f1a 100%)",
        }}
      />
      {/* Film-grain noise overlay. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{ backgroundImage: NOISE_DATA_URL, backgroundSize: "200px 200px" }}
      />
      {/* Accent stripe — gives the slot a "framed" feel. */}
      {accent === "bottom" && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1.5 bg-accent-500"
        />
      )}
      {accent === "left" && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5 bg-accent-500"
        />
      )}

      {/* Overlay typography. */}
      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-300">
            {eyebrow}
          </p>
        )}
        {headline && (
          <p className="mt-1 text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
            {headline}
          </p>
        )}
        {/* Slot label — small, subtle, dev-facing. */}
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-cream-50/15 bg-black/30 px-2.5 py-0.5 text-[10px] font-mono text-cream-50/60 backdrop-blur">
          <span aria-hidden="true">📷</span>
          IMAGE_SLOT: {slot}
        </p>
      </div>
    </div>
  );
}
