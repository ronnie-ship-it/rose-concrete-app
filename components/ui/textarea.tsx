import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea primitive. Same focus + invalid styling as Input — kept in
 * lockstep so the lead form reads as one consistent surface.
 */

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base",
        "placeholder:text-neutral-400",
        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
        "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
        "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500/30",
        "resize-y min-h-[6rem]",
        className,
      )}
      {...rest}
    />
  );
});
