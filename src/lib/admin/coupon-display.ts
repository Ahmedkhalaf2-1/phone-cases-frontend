import type { AdminCoupon, CouponStatus, CouponType } from "./types";

/** Backend limits, mirrored so the editor can explain problems before a round trip. */
export const COUPON_LIMITS = {
  codePattern: /^[A-Za-z0-9_-]{3,32}$/,
  maxMinorUnits: 2_000_000_000,
  maxUsageLimit: 1_000_000,
} as const;

/** Whole EGP, trimmed: 5000 -> "50", 12550 -> "125.5". */
function egp(minorUnits: number): string {
  const amount = minorUnits / 100;
  return `EGP ${Number.isInteger(amount) ? amount : amount.toFixed(2).replace(/0+$/, "")}`;
}

export function formatDiscount(type: CouponType, value: number): string {
  return type === "PERCENTAGE" ? `${value}% OFF` : `${egp(value)} OFF`;
}

export function formatMinSpend(minSpend: number | null): string {
  return minSpend ? egp(minSpend) : "No minimum";
}

export function formatUsage(usageCount: number, usageLimit: number | null): string {
  return usageLimit !== null ? `${usageCount} / ${usageLimit}` : `${usageCount} used`;
}

/** 0-100, or null when the coupon has no usage limit. */
export function usagePercent(usageCount: number, usageLimit: number | null): number | null {
  if (usageLimit === null || usageLimit <= 0) return null;
  return Math.min(100, Math.round((usageCount / usageLimit) * 100));
}

export const COUPON_STATUS_STYLE: Record<CouponStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-800" },
  SCHEDULED: { label: "Scheduled", className: "bg-amber-100 text-amber-800" },
  EXPIRED: { label: "Expired", className: "bg-surface text-muted-foreground" },
  EXHAUSTED: { label: "Used up", className: "bg-surface text-accent" },
  DISABLED: { label: "Disabled", className: "bg-surface text-muted-foreground" },
};

export const COUPON_STATUS_ORDER: CouponStatus[] = [
  "ACTIVE",
  "SCHEDULED",
  "EXPIRED",
  "EXHAUSTED",
  "DISABLED",
];

export function matchesSearch(coupon: AdminCoupon, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || coupon.code.toLowerCase().includes(needle);
}

export type CouponField = "code" | "value" | "minSpend" | "usageLimit" | "startsAt" | "expiresAt";

/**
 * Maps a backend validation message onto the field it is about, so errors
 * render next to the control. Anything unrecognised stays a form-level
 * error rather than being attached to the wrong field.
 */
export function fieldForBackendMessage(message: string, apiCode?: string): CouponField | null {
  if (apiCode === "COUPON_CODE_TAKEN") return "code";
  const m = message.toLowerCase();
  if (m.startsWith("code") || m.includes("coupon with code")) return "code";
  if (m.startsWith("value") || m.includes("coupon value")) return "value";
  if (m.startsWith("minspend")) return "minSpend";
  if (m.startsWith("usagelimit")) return "usageLimit";
  if (m.startsWith("startsat")) return "startsAt";
  if (m.startsWith("expiresat")) return "expiresAt";
  return null;
}
