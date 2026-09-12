import Link from "next/link";
import { PhoneCaseIllustration } from "@/components/graphics/PhoneCaseIllustration";
import { formatPrice } from "@/lib/format-price";
import { getCompatibilityLabel } from "@/lib/compatibility";
import type { PublicProductSummary } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

function isDemoProduct(
  product: PublicProductSummary | DemoProduct,
): product is DemoProduct {
  return "artwork" in product;
}

export function ProductCard({
  product,
  source,
}: {
  product: PublicProductSummary | DemoProduct;
  source: "demo" | "live";
}) {
  const isDemo = isDemoProduct(product);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group rounded-sm border border-border bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="aspect-square overflow-hidden rounded-t-sm bg-surface">
        {isDemo ? (
          <PhoneCaseIllustration
            artwork={product.artwork}
            className="mx-auto h-full max-h-56 py-4 transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : product.primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.primaryImage.url}
            alt={product.primaryImage.altText ?? product.name}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 p-3 sm:p-4">
        <div>
          <p className="font-semibold text-ink">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            {isDemo
              ? getCompatibilityLabel(product.variants)
              : (product.collections[0]?.name ?? "")}
          </p>
          {!product.isAvailable && (
            <p className="mt-1 text-xs font-semibold text-accent uppercase">
              Out of stock
            </p>
          )}
          {source === "live" && product.effectivePriceFrom !== null && (
            <p className="mt-1 text-sm font-semibold text-ink">
              {formatPrice(product.effectivePriceFrom, product.currency)}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-ink transition-colors group-hover:border-accent group-hover:text-accent"
        >
          →
        </span>
      </div>
    </Link>
  );
}
