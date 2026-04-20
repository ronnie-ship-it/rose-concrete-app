import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui's standard `cn()` helper — clsx for conditional class lists,
 * tailwind-merge for resolving the inevitable "two paddings, last one wins"
 * conflicts that come from passing className overrides into a primitive.
 *
 * Use anywhere you'd otherwise template-string-concat Tailwind classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
