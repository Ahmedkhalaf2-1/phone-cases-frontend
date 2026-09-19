import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import { getCompatibilityLabel } from "@/lib/compatibility";
import type { PublicProductSummary, PublicVariant } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

function hasVariants(
  product: PublicProductSummary | DemoProduct,
): product is DemoProduct & { variants: PublicVariant[] } {
  return "variants" in product;
}

export function ProductCard({
  product,
  source,
}: {
  product: PublicProductSummary | DemoProduct;
  source: "demo" | "live";
}) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group rounded-card bg-surface shadow-card transition-transform duration-300 ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-card-inner m-2 bg-surface">
        {product.primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.primaryImage.url}
            alt={product.primaryImage.altText ?? product.name}
            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 p-3 sm:p-4">
        <div>
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
