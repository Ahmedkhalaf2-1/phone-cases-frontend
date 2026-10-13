"use client";

import { cartBundleMessage } from "@/lib/bundles";
import type { BundleProgress } from "@/lib/cart/types";

/**
 * One calm line about the bundle the cart is working towards. Everything it
 * says comes from the backend's `bundleProgress`; the amount saved is the
 * backend's `bundleDiscountTotal`. Renders nothing when there is nothing
 * eligible. Coupon removal reuses the cart page's existing handler.
 */
export function BundleProgressNotice({
  progress,
  bundleDiscountTotal,
  currency,
  onRemoveCoupon,
}: {
  progress: BundleProgress | null | undefined;
  bundleDiscountTotal: number;
  currency: string;
  onRemoveCoupon: () => void;
}) {
  const message = cartBundleMessage(progress, bundleDiscountTotal, currency);
  if (!message) return null;

  const applied = message.kind === "applied";
  const blocked = message.kind === "coupon-blocked";

  return (
    <div
      role="status"
      className={`mb-6 flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
        applied
          ? "bg-green-50 text-green-900"
          : blocked
            ? "bg-accent/5 text-ink"
            : "bg-accent-wash text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${applied ? "bg-green-600" : "bg-accent"}`}
      />
      <div className="min-w-0">
        <p className="font-medium">{message.text}</p>
        {blocked && (
          <button
            type="button"
            onClick={onRemoveCoupon}
            className="mt-1 text-[13px] font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Remove coupon
          </button>
        )}
      </div>
    </div>
  );
}
