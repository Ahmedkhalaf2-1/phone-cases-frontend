export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the customer's language; read on the server so SSR is correct on first paint. */
export const LOCALE_COOKIE = "contrast-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Direction = "ltr" | "rtl";

export const DIRECTION: Record<Locale, Direction> = { en: "ltr", ar: "rtl" };

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ar";
}

/** Locale tags for Intl. `-u-nu-latn` keeps Western digits (0-9) in Arabic, per the commerce convention. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-EG-u-nu-latn",
};
