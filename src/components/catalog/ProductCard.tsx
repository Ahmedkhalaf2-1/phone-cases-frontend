import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import { getCompatibilityLabel } from "@/lib/compatibility";
import { LinkPending } from "@/components/motion/LinkPending";
import { SharedProductImage } from "@/components/motion/SharedProductImage";
import { getActiveBundleOffers } from "@/lib/data/bundles";
import { cardBadge, offerForProduct } from "@/lib/bundles";
import type { PublicProductSummary, PublicVariant } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

function hasVariants(
  product: PublicProductSummary | DemoProduct,
): product is DemoProduct & { variants: PublicVariant[] } {
  return "variants" in product;
}

export async function ProductCard({
  product,
  source,
  imageLoading = "lazy",
  sharedImage = true,
}: {
  product: PublicProductSummary | DemoProduct;
  source: "demo" | "live";
  /** "eager" only for cards visible on first paint (first row of a grid/rail). */
  imageLoading?: "lazy" | "eager";
  /**
   * Whether this card's image is the product-page morph source. Pass false
   * when the same product also appears elsewhere on the page: the
   * view-transition name must be unique per document.
   */
  sharedImage?: boolean;
}) {
  // Offers are fetched once per request (cached); no offer -> no badge.
  const bundleOffer = offerForProduct(await getActiveBundleOffers(), product.slug);
  return (
    <Link
      href={`/products/${product.slug}`}
      className="sf-nav-target group flex h-full flex-col rounded-card bg-surface shadow-card transition-transform duration-[var(--sf-dur-normal)] ease-[var(--sf-ease)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <LinkPending />
      <SharedProductImage slug={product.slug} enabled={sharedImage}>
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-card-inner m-2 bg-surface">
          {product.primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.primaryImage.url}
              alt={product.primaryImage.altText ?? product.name}
              loading={imageLoading}
              decoding="async"
              className="h-full w-full object-contain transition-transform duration-[var(--sf-dur-slow)] ease-[var(--sf-ease)] group-hover:scale-[1.03] motion-reduce:transform-none"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
      </SharedProductImage>

      <div className="flex flex-1 items-start justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="font-medium tracking-tight text-ink">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            {hasVariants(product)
              ? getCompatibilityLabel(product.variants)
              : (product.collections[0]?.name ?? "")}
          </p>
          {!product.isAvailable && (
            <p className="mt-1 text-xs font-medium text-accent">
              Out of stock
            </p>
          )}
          {source === "live" && product.effectivePriceFrom !== null && (
            <p className="mt-1 text-sm font-medium text-ink">
              {formatPrice(product.effectivePriceFrom, product.currency)}
            </p>
          )}
          {bundleOffer && (
            <p className="mt-1.5">
              <span className="inline-block rounded-pill bg-accent-wash px-2 py-0.5 text-[11px] font-semibold tracking-tight text-ink">
                {cardBadge(bundleOffer)}
              </span>
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill border border-border text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white"
        >
          →
        </span>
      </div>
    </Link>
  );
}
