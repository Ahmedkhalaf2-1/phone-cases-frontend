"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { useFormatPrice } from "@/i18n/useFormatPrice";
import { getCompatibilityLabel } from "@/lib/compatibility";
import { LinkPending } from "@/components/motion/LinkPending";
import { SharedProductImage } from "@/components/motion/SharedProductImage";
import type { PublicProductSummary, PublicVariant } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

function hasVariants(
  product: PublicProductSummary | DemoProduct,
): product is DemoProduct & { variants: PublicVariant[] } {
  return "variants" in product;
}

export type ProductCardLayout = "grid" | "list";

export function ProductCard({
  product,
  source,
  imageLoading = "lazy",
  sharedImage = true,
  layout = "grid",
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
  /** "list" shows a compact horizontal row (image left, details right). */
  layout?: ProductCardLayout;
}) {
  const { t } = useI18n();
  const formatPrice = useFormatPrice();

  return (
    <Link
      href={`/products/${product.slug}`}
      className={`sf-nav-target group flex h-full ${layout === "list" ? "flex-row items-center" : "flex-col"} rounded-card bg-surface shadow-card transition-transform duration-[var(--sf-dur-normal)] ease-[var(--sf-ease)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      <LinkPending />
      <SharedProductImage slug={product.slug} enabled={sharedImage}>
        <div className={`flex aspect-square items-center justify-center overflow-hidden rounded-card-inner m-2 bg-surface ${layout === "list" ? "w-28 shrink-0 sm:w-40" : ""}`}>
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
              {t("product.noImage")}
            </div>
          )}
        </div>
      </SharedProductImage>

      <div className={`flex flex-1 items-start justify-between gap-2 p-3 sm:p-4 ${layout === "list" ? "items-center" : ""}`}>
        <div className="min-w-0">
          <p className="font-medium tracking-tight text-ink">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            <bdi>
              {hasVariants(product)
                ? getCompatibilityLabel(product.variants)
                : (product.collections[0]?.name ?? "")}
            </bdi>
          </p>
          {!product.isAvailable && (
            <p className="mt-1 text-xs font-medium text-accent">
              {t("common.outOfStock")}
            </p>
          )}
          {source === "live" && product.effectivePriceFrom !== null && (
            <p className="mt-1 text-sm font-medium text-ink">
              {formatPrice(product.effectivePriceFrom, product.currency)}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill rtl:-scale-x-100 border border-border text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white"
        >
          →
        </span>
      </div>
    </Link>
  );
}
