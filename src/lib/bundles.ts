import type { AnnouncementBanner, BundleOffer } from "@/lib/api/types";
import type { BundleProgress } from "@/lib/cart/types";
import { formatOfferPriceFor } from "@/i18n/format";
import type { Translator } from "@/i18n/translate";

/**
 * Everything the storefront SAYS about bundles lives here, built only from
 * values the backend returned (size, total, minimum saving, flags). Nothing
 * is hardcoded and nothing is inferred from discount arithmetic. Copy comes
 * from the i18n dictionary, so it follows the active language.
 */

/** The subset of the translator the copy helpers need. */
export type BundleI18n = Pick<Translator, "t" | "tn" | "locale">;

/** "450 EGP" / "450 ج.م" - promotional copy: whole amounts without decimals. */
export function formatOfferPrice(minorUnits: number, currency: string, locale: BundleI18n["locale"] = "en"): string {
  return formatOfferPriceFor(locale, minorUnits, currency);
}

const perUnit = (o: Pick<BundleOffer, "fixedTotal" | "bundleSize">) => o.fixedTotal / o.bundleSize;

/** The offer to lead with: the cheapest price per case, then the larger proven saving. */
export function pickPrimaryOffer(offers: BundleOffer[]): BundleOffer | null {
  if (offers.length === 0) return null;
  return [...offers].sort(
    (a, b) => perUnit(a) - perUnit(b) || b.minSavings - a.minSavings,
  )[0];
}

/**
 * The banner for the top announcement bar. The backend already resolves
 * which single offer may show one; this only reads it.
 */
export function pickAnnouncementBanner(
  offers: BundleOffer[],
  i18n: BundleI18n,
): AnnouncementBanner | null {
  for (const offer of offers) {
    const banner = offer.announcementBanner;
    if (banner?.enabled && banner.text.trim() && banner.target?.href.startsWith("/")) {
      return { ...banner, ...localizedBanner(banner, offer, i18n) };
    }
  }
  return null;
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

const price = (i18n: BundleI18n, minor: number, currency: string) =>
  formatOfferPrice(minor, currency, i18n.locale);

/** "2 CASES. 450 EGP." */
export function offerHeadline(o: BundleOffer, i18n: BundleI18n): string {
  return i18n
    .t("bundles.headline", {
      cases: i18n.tn("bundles.cases", o.bundleSize),
      price: price(i18n, o.fixedTotal, o.currency),
    })
    .toUpperCase();
}

export function offerBody(o: BundleOffer, i18n: BundleI18n): string {
  const params = {
    cases: i18n.tn("bundles.eligibleCases", o.bundleSize),
    diff: o.requireDifferentPhoneModels ? i18n.t("bundles.diffModelsPlural") : "",
  };
  return o.minSavings > 0
    ? i18n.t("bundles.bodySave", { ...params, saving: price(i18n, o.minSavings, o.currency) })
    : i18n.t("bundles.bodyPrice", params);
}

export function productNote(o: BundleOffer, i18n: BundleI18n): string {
  const total = price(i18n, o.fixedTotal, o.currency);
  if (o.bundleSize === 2) {
    return o.requireDifferentPhoneModels
      ? i18n.t("bundles.noteDifferent", { price: total })
      : i18n.t("bundles.noteSecond", { price: total });
  }
  return i18n.t("bundles.noteMore", {
    more: i18n.tn("bundles.moreEligible", o.bundleSize - 1),
    diff: o.requireDifferentPhoneModels ? i18n.t("bundles.diffEach") : "",
    size: o.bundleSize,
    price: total,
  });
}

/**
 * The top-bar text/CTA. The backend generates an English default when an
 * admin leaves them empty; when the received text is exactly that default
 * it is rebuilt here in the active language from the offer's own values.
 * Admin-written copy is always shown as written.
 */
export function localizedBanner(
  banner: AnnouncementBanner,
  offer: BundleOffer,
  i18n: BundleI18n,
): { text: string; ctaLabel: string } {
  const amount = offer.fixedTotal / 100;
  const enPrice = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const backendDefault = `${offer.bundleSize} CASES FOR ${enPrice} ${offer.currency}`.toUpperCase();
  const isDefaultText = banner.text.trim().toUpperCase() === backendDefault;
  const isDefaultCta = banner.ctaLabel.trim().toUpperCase() === "SHOP NOW";
  return {
    text: isDefaultText
      ? i18n
          .t("bundles.bannerDefaultText", {
            cases: i18n.tn("bundles.cases", offer.bundleSize),
            price: price(i18n, offer.fixedTotal, offer.currency),
          })
          .toUpperCase()
      : banner.text,
    ctaLabel: isDefaultCta ? i18n.t("bundles.bannerDefaultCta") : banner.ctaLabel,
  };
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
  i18n: BundleI18n,
): CartBundleMessage | null {
  if (!progress) return null;
  const size = progress.bundleSize;

  if (progress.blockedByCoupon && progress.eligibleUnits >= size) {
    return {
      kind: "coupon-blocked",
      text: i18n.t("bundles.cartBlocked", {
        size,
        price: price(i18n, progress.fixedTotal, progress.currency),
      }),
    };
  }

  if (progress.groupsApplied > 0) {
    const saved = price(i18n, bundleDiscountTotal, currency);
    return {
      kind: "applied",
      text:
        progress.groupsApplied === 1
          ? i18n.t("bundles.cartAppliedOne", { saved })
          : i18n.t("bundles.cartAppliedMany", { count: progress.groupsApplied, saved }),
    };
  }

  if (progress.unitsNeeded !== null && progress.unitsNeeded > 0) {
    const saving =
      progress.savingsIfCompleted !== null && progress.savingsIfCompleted > 0
        ? i18n.t("bundles.cartSaving", {
            saving: price(i18n, progress.savingsIfCompleted, progress.currency),
          })
        : "";
    return {
      kind: "progress",
      text: i18n.t("bundles.cartProgress", {
        more: i18n.tn("bundles.moreEligible", progress.unitsNeeded),
        diff: progress.requireDifferentPhoneModels ? i18n.t("bundles.diffModelForOne") : "",
        saving,
      }),
    };
  }
  return null;
}
