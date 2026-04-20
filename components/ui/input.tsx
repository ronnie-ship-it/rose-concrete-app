import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Form input primitive. Tuned for the lead form's job:
 *   - Larger text on mobile so the iOS keyboard doesn't auto-zoom in
 *     (anything below 16px triggers the zoom on focus).
 *   - High-contrast border so the field is obviously fillable on cream.
 *   - Brand-aligned focus ring so the active field reads as "yes, here."
 *   - `aria-invalid` flips the border red so client-side errors land
 *     visually without needing extra wrapper components.
 */

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base",
        "placeholder:text-neutral-400",
        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
        "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
        "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500/30",
        className,
      )}
      {...rest}
    />
  );
});
