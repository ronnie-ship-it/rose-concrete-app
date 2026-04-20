import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn-style button primitive.
 *
 * Variants picked to match the marketing site's visual job:
 *   primary   — main CTA on every page (high-contrast brand navy)
 *   accent    — secondary CTA / phone button (teal, attention-grabbing
 *               without competing with the primary)
 *   outline   — ghost-style for nav and footer
 *   secondary — neutral fill, used when paired with a primary button
 *
 * Sizes scale up to `xl` because the click-to-call button in the header
 * needs to be thumb-tappable on mobile (44px+ tap target).
 *
 * For NAVIGATION (link that visually looks like a button), don't wrap a
 * <Button> in an <a> — that's a nested-interactive antipattern. Instead
 * apply `buttonClassNames(...)` directly to the <a>:
 *
 *   <a href="..." className={buttonClassNames({ variant: "accent", size: "lg" })}>
 *     Call now
 *   </a>
 *
 * Only use the <Button> component when the click triggers a state change
 * or form submit (i.e. you actually want a <button> in the DOM).
 */

export type ButtonVariant = "primary" | "accent" | "outline" | "secondary";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  accent:
    "bg-accent-500 text-brand-900 shadow-sm hover:bg-accent-600 hover:text-white active:bg-accent-700",
  outline:
    "border border-brand-200 bg-white text-brand-700 hover:border-brand-400 hover:bg-brand-50",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  xl: "h-14 px-7 text-lg",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2";

/**
 * Compose the button class string. Use this directly on <a> elements when
 * you need a navigation link styled as a button. Use the <Button>
 * component when you need a real <button> for form submission etc.
 */
export function buttonClassNames(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const variant = opts?.variant ?? "primary";
  const size = opts?.size ?? "md";
  return cn(
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    opts?.className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassNames({ variant, size, className })}
      {...rest}
    />
  );
});
