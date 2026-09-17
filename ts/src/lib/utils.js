// Adapted from haystack code/src/lib/utils.js; kept local to this POD.
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
