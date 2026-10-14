import { INTL_LOCALE, type Locale } from "./config";

/** Arabic currency labels; unknown currencies fall back to their ISO code. */
const AR_CURRENCY: Record<string, string> = { EGP: "ج.م" };

/**
 * Prices from the backend are integer minor units. English keeps the
 * existing symbol format ("E£250"); Arabic uses the number followed by the
 * local currency label ("250 ج.م"), always with Western digits.
 */
export function formatPriceFor(locale: Locale, minorUnits: number, currency: string): string {
  if (locale === "ar") {
    const amount = new Intl.NumberFormat(INTL_LOCALE.ar, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
    return `${amount} ${AR_CURRENCY[currency] ?? currency}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

/** "450 EGP" / "450 ج.م" - promotional copy: whole amounts without decimals. */
export function formatOfferPriceFor(locale: Locale, minorUnits: number, currency: string): string {
  const amount = minorUnits / 100;
  const text = Number.isInteger(amount)
    ? amount.toLocaleString("en-US")
    : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const label = locale === "ar" ? (AR_CURRENCY[currency] ?? currency) : currency;
  return `${text} ${label}`;
}

/** "Sat, 18 Oct" / "السبت، 18 أكتوبر" in the visitor's calendar day. */
export function formatDayShort(locale: Locale, date: Date): string {
  const parts = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const comma = locale === "ar" ? "،" : ",";
  return `${pick("weekday")}${comma} ${pick("day")} ${pick("month")}`;
}

/** Locale-aware long date + time for order timestamps. */
export function formatDateTimeFor(locale: Locale, iso: string): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
