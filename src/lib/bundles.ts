import type { BundleOffer } from "@/lib/api/types";
import type { BundleProgress } from "@/lib/cart/types";

/**
 * Everything the storefront SAYS about bundles lives here, built only from
 * values the backend returned (size, total, minimum saving, flags). Nothing
 * is hardcoded and nothing is inferred from discount arithmetic.
 */

/** "450 EGP" - promotional copy: whole amounts without decimals. */
export function formatOfferPrice(minorUnits: number, currency: string): string {
  const amount = minorUnits / 100;
  const text = Number.isInteger(amount)
    ? amount.toLocaleString("en-US")
    : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} ${currency}`;
}

const perUnit = (o: Pick<BundleOffer, "fixedTotal" | "bundleSize">) => o.fixedTotal / o.bundleSize;

/** The offer to lead with: the cheapest price per case, then the larger proven saving. */
export function pickPrimaryOffer(offers: BundleOffer[]): BundleOffer | null {
  if (offers.length === 0) return null;
  return [...offers].sort(
    (a, b) => perUnit(a) - perUnit(b) || b.minSavings - a.minSavings,
  )[0];
}

/** Offers that apply to this product (server-resolved slugs), best first. */
export function offerForProduct(offers: BundleOffer[], productSlug: string): BundleOffer | null {
  return pickPrimaryOffer(
    offers.filter(
      (o) => o.appliesTo.type === "ALL" || o.appliesTo.productSlugs.includes(productSlug),
    ),
  );
}

/**
 * Stable identity of an offer for "already dismissed" bookkeeping. Built
 * from the deal's own properties, so a genuinely new or changed offer gets a
 * new key and may be shown again.
 */
export function offerSignature(o: BundleOffer): string {
  return [
    o.bundleSize,
    o.fixedTotal,
    o.currency,
    o.scope,
    o.requireDifferentPhoneModels ? "diff" : "any",
  ].join(":");
}

const cases = (n: number) => (n === 1 ? "case" : "cases");

/** "2 CASES. 450 EGP." */
export function offerHeadline(o: BundleOffer): string {
  return `${o.bundleSize} ${cases(o.bundleSize)}. ${formatOfferPrice(o.fixedTotal, o.currency)}.`.toUpperCase();
}

export function offerBody(o: BundleOffer): string {
  const pick = `Pick any ${o.bundleSize} eligible ${cases(o.bundleSize)}${
    o.requireDifferentPhoneModels ? " for different phone models" : ""
  }`;
  return o.minSavings > 0
    ? `${pick} and save at least ${formatOfferPrice(o.minSavings, o.currency)} automatically.`
    : `${pick} and get the bundle price automatically.`;
}

/** "2 for 450 EGP" */
export function cardBadge(o: BundleOffer): string {
  return `${o.bundleSize} for ${formatOfferPrice(o.fixedTotal, o.currency)}`;
}

export function productNote(o: BundleOffer): string {
  const price = formatOfferPrice(o.fixedTotal, o.currency);
  if (o.bundleSize === 2) {
    return o.requireDifferentPhoneModels
      ? `Pair it with a case for a different phone model and get both for ${price}.`
      : `Add any second eligible case and get both for ${price}.`;
  }
  const more = o.bundleSize - 1;
  return `Add any ${more} more eligible ${cases(more)}${
    o.requireDifferentPhoneModels ? ", each for a different phone model," : ""
  } and get all ${o.bundleSize} for ${price}.`;
}

export type CartBundleMessage =
  | { kind: "coupon-blocked"; text: string }
  | { kind: "applied"; text: string }
  | { kind: "progress"; text: string };

/**
 * The single cart message for the offer the backend says the cart is
 * working towards. State comes from `BundleProgress` only.
 */
export function cartBundleMessage(
  progress: BundleProgress | null | undefined,
  bundleDiscountTotal: number,
  currency: string,
): CartBundleMessage | null {
  if (!progress) return null;
  const price = formatOfferPrice(progress.fixedTotal, progress.currency);
  const size = progress.bundleSize;

  if (progress.blockedByCoupon && progress.eligibleUnits >= size) {
    return {
      kind: "coupon-blocked",
      text: `Your coupon can't be combined with the ${size} for ${price} bundle. Remove the coupon to get the bundle price.`,
    };
  }

  const more = (n: number) =>
    `${n} more eligible ${cases(n)}${progress.requireDifferentPhoneModels ? " for a different phone model" : ""}`;

  if (progress.groupsApplied > 0) {
    const saved = formatOfferPrice(bundleDiscountTotal, currency);
    return {
      kind: "applied",
      text:
        progress.groupsApplied === 1
          ? `Bundle applied — you saved ${saved}.`
          : `${progress.groupsApplied} bundles applied — you saved ${saved}.`,
    };
  }

  if (progress.unitsNeeded !== null && progress.unitsNeeded > 0) {
    const unlock =
      progress.savingsIfCompleted !== null && progress.savingsIfCompleted > 0
        ? ` to unlock the bundle and save at least ${formatOfferPrice(progress.savingsIfCompleted, progress.currency)}`
        : " to unlock the bundle";
    return { kind: "progress", text: `Add ${more(progress.unitsNeeded)}${unlock}.` };
  }
  return null;
}
