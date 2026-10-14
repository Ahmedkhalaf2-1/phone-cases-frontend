import type { DeepMessages } from "./types";

/**
 * Defines one dictionary section with both languages side by side. The
 * Arabic object is checked against the English shape, so a missing or
 * extra key fails `tsc`.
 */
export function section<E extends object>(en: E, ar: DeepMessages<E>): { en: E; ar: DeepMessages<E> } {
  return { en, ar };
}
