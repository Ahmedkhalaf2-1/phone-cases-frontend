import { formatPrice } from "@/lib/format-price";
import { getCollectionCover } from "@/config/collection-covers";
import type {
  AdminCollection,
  AdminProduct,
  ProductMediaAttachment,
  ProductStatus,
} from "@/lib/admin/types";

/**
 * Plain-language status names for staff. The backend enum stays the
 * source of truth; only the wording shown in the admin changes.
 */
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  PUBLISHED: "Active",
  DRAFT: "Draft",
  ARCHIVED: "Hidden",
};

export const PRODUCT_STATUS_HINT: Record<ProductStatus, string> = {
  PUBLISHED: "Visible in the shop",
  DRAFT: "Not visible yet — still being prepared",
  ARCHIVED: "Removed from the shop",
};

export const PRODUCT_STATUS_STYLE: Record<ProductStatus, string> = {
  PUBLISHED: "bg-green-100 text-green-800",
  DRAFT: "bg-amber-100 text-amber-800",
  ARCHIVED: "bg-surface text-muted-foreground",
};

/**
 * Media in the order the customer sees it: primary first, then by
 * `displayOrder`. Older attachments were all created with the default
 * `displayOrder`, so ties fall back to attach order (the array order the
 * backend returned).
 */
export function orderedMedia(product: Pick<AdminProduct, "media">): ProductMediaAttachment[] {
  return (product.media ?? [])
    .map((attachment, index) => ({ attachment, index }))
    .sort(
      (a, b) =>
        Number(b.attachment.isPrimary) - Number(a.attachment.isPrimary) ||
        a.attachment.displayOrder - b.attachment.displayOrder ||
        a.index - b.index,
    )
    .map(({ attachment }) => attachment);
}

export function primaryImageUrl(product: Pick<AdminProduct, "media">): string | null {
  return orderedMedia(product)[0]?.mediaAsset.url ?? null;
}

/** "450 EGP", or "450 – 520 EGP" when variants differ; null with no variants. */
export function priceSummary(product: Pick<AdminProduct, "variants" | "currency">): string | null {
  const prices = (product.variants ?? []).map((v) => v.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatPrice(min, product.currency);
  return `${formatPrice(min, product.currency)} – ${formatPrice(max, product.currency)}`;
}

/**
 * The cover a collection currently shows: the uploaded one if the
 * backend has it, otherwise the built-in static cover.
 */
export function collectionCoverUrl(collection: AdminCollection): {
  url: string;
  source: "uploaded" | "built-in";
} | null {
  if (collection.coverMediaAsset?.url) {
    return { url: collection.coverMediaAsset.url, source: "uploaded" };
  }
  const builtIn = getCollectionCover(collection.slug);
  return builtIn ? { url: builtIn.src, source: "built-in" } : null;
}
