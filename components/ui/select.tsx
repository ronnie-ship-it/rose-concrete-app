import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Select primitive — deliberately a native HTML <select>, not Radix.
 *
 * Why native: this is the dropdown in the lead form, which is the most
 * conversion-critical control on the site. Native selects render the OS
 * picker on mobile (iOS wheel, Android list), which is what every user
 * already knows how to use. Radix Select would add ~12kb to the marketing
 * bundle and beat the OS UX on phones — bad trade for a contractor site
 * targeting LCP under a second on cold cell connections.
 *
 * Children are <option> elements supplied by the caller.
 */

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "block w-full appearance-none rounded-md border border-neutral-300 bg-white px-3 py-2.5 pr-9 text-base",
        // Inline SVG chevron — tinted brand-700 to read against cream/white.
        "bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%23162139%22><path%20d=%22M5.23%207.21a.75.75%200%200%201%201.06.02L10%2011.06l3.71-3.83a.75.75%200%200%201%201.08%201.04l-4.25%204.39a.75.75%200%200%201-1.08%200L5.21%208.27a.75.75%200%200%201%20.02-1.06z%22/></svg>')] bg-[position:right_0.6rem_center] bg-no-repeat",
        "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30",
        "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
        "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500/30",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
