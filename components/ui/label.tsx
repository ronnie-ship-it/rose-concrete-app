import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Label primitive. Pairs by `htmlFor` with the form controls. Includes
 * a `required` flag that renders the asterisk in brand teal so it pops
 * against the navy text without screaming "RED ERROR".
 */

export const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }
>(function Label({ className, children, required, ...rest }, ref) {
  return (
    <label
      ref={ref}
      className={cn(
        "block text-sm font-semibold text-brand-800",
        className,
      )}
      {...rest}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-accent-600">
          *
        </span>
      ) : null}
    </label>
  );
});
