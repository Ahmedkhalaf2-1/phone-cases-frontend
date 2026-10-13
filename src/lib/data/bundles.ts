import { cache } from "react";
import { DEMO_MODE } from "@/lib/env";
import { apiGet } from "@/lib/api/http";
import type { BundleOffer } from "@/lib/api/types";

/**
 * Active bundle offers, for product-card badges and the product page.
 * Cached per request (and by the fetch cache for 60s). Offers are a
 * convenience: if the endpoint is missing (older backend) or down, the
 * storefront simply shows no offer messaging - it never breaks a page.
 */
export const getActiveBundleOffers = cache(async (): Promise<BundleOffer[]> => {
  if (DEMO_MODE) return [];
  try {
    const offers = await apiGet<BundleOffer[]>("/bundles/active");
    return Array.isArray(offers) ? offers : [];
  } catch {
    return [];
  }
});
