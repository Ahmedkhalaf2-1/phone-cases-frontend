import { formatEgp } from "./money";
import type { ShippingRate } from "./types";

/** Backend limits (mirrored for inline validation; the server stays authoritative). */
export const SHIPPING_LIMITS = {
  maxMinorUnits: 2_000_000_000,
  maxDays: 365,
  maxDisplayOrder: 1_000_000,
  countryPattern: /^[A-Za-z]{2}$/,
} as const;

/** "2–5 days", "2 days", "Up to 5 days", or null when no estimate is set. */
export function formatDeliveryEstimate(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    if (min === max) return `${min} ${min === 1 ? "day" : "days"}`;
    return `${min}–${max} days`;
  }
  if (min !== null) return `From ${min} ${min === 1 ? "day" : "days"}`;
  return `Up to ${max} ${max === 1 ? "day" : "days"}`;
}

export function formatRatePrice(price: number): string {
  return price === 0 ? "Free" : formatEgp(price);
}

/**
 * The backend makes a rate free once the order total *reaches* the
 * threshold (>=), so "from" is accurate where "over" would be wrong.
 */
export function formatFreeShipping(rate: Pick<ShippingRate, "freeShippingThreshold">): string | null {
  return rate.freeShippingThreshold !== null
    ? `Free from ${formatEgp(rate.freeShippingThreshold)}`
    : null;
}

let regionNames: Intl.DisplayNames | null | undefined;

/** "EG" -> "Egypt". Returns null if the runtime can't name the code. */
export function countryName(code: string): string | null {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    const name = regionNames?.of(code.toUpperCase());
    // "ZZ" and unassigned codes come back as the code itself or "Unknown Region".
    if (!name || name.toUpperCase() === code.toUpperCase() || /^unknown region$/i.test(name)) {
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

/** Parses "eg, sa  ae" into unique upper-case codes; keeps order. */
export function parseCountries(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const code = part.trim().toUpperCase();
    if (code) seen.add(code);
  }
  return [...seen];
}

export type ShippingField =
  | "nameEn"
  | "nameAr"
  | "countries"
  | "price"
  | "freeShippingThreshold"
  | "estimatedDaysMin"
  | "estimatedDaysMax"
  | "displayOrder";

/** Maps a backend validation message onto its field; unknown messages stay form-level. */
export function fieldForShippingMessage(message: string): ShippingField | null {
  const m = message.toLowerCase();
  for (const field of [
    "freeShippingThreshold",
    "estimatedDaysMin",
    "estimatedDaysMax",
    "displayOrder",
    "nameEn",
    "nameAr",
    "countries",
    "price",
  ] as const) {
    if (m.startsWith(field.toLowerCase())) return field;
  }
  if (m.includes("each country")) return "countries";
  return null;
}
