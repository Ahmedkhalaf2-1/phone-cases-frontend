import Link from "next/link";
import { formatPrice } from "@/lib/format-price";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_STYLE,
  priceSummary,
  primaryImageUrl,
} from "@/lib/admin/product-display";
import type { AdminProduct } from "@/lib/admin/types";

/**
 * Image-led product tile for admin grids — staff recognise a design from
 * its picture long before its name. The whole tile opens the product.
 */
export function AdminProductCard({
  product,
  href,
  action,
}: {
  product: AdminProduct;
  href: string;
  /** Optional extra control at the bottom of the card (e.g. "Remove from collection"). */
  action?: React.ReactNode;
}) {
  const image = primaryImageUrl(product);
  const price = priceSummary(product);
  const imageCount = product.media?.length ?? 0;
  const variants = product.variants ?? [];
  const activeVariants = variants.filter((v) => v.isActive).length;

  // Biggest discount among variants on sale, for the badge and "was" price.
  const sale = variants.reduce<{ was: number; percent: number } | null>((best, v) => {
    if (v.compareAtPrice === null || v.compareAtPrice <= v.price) return best;
    const percent = Math.round(((v.compareAtPrice - v.price) / v.compareAtPrice) * 100);
    return !best || percent > best.percent ? { was: v.compareAtPrice, percent } : best;
  }, null);

  return (
    <li className="group flex flex-col rounded-card bg-surface p-2 shadow-card transition-transform duration-300 ease-out hover:-translate-y-0.5">
      <Link
        href={href}
        className="flex flex-1 flex-col rounded-card-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="relative aspect-square overflow-hidden rounded-card-inner bg-background">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-amber-800">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-8">
                <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 18l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              No image yet
            </span>
          )}
          <span
            className={`absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${PRODUCT_STATUS_STYLE[product.status]}`}
          >
            {PRODUCT_STATUS_LABEL[product.status]}
          </span>
          {sale && (
            <span className="absolute end-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              −{sale.percent}%
            </span>
          )}
          {imageCount > 1 && (
            <span className="absolute end-2 bottom-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-ink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="size-3">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {imageCount}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-2 pt-3 pb-1.5">
          <p className="line-clamp-2 leading-snug font-semibold text-ink group-hover:text-accent">{product.nameEn}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-sm">
            {price ? (
              <>
                <span className="font-semibold text-ink">{price}</span>
                {sale && (
                  <s className="text-xs text-muted-foreground">{formatPrice(sale.was, product.currency)}</s>
                )}
              </>
            ) : (
              <span className="font-semibold text-amber-700">No price yet</span>
            )}
          </p>
          <p className="mt-auto pt-1 text-xs text-muted-foreground">
            {variants.length === 0 ? (
              <span className="text-amber-700">No variants</span>
            ) : (
              <>
                {variants.length} variant{variants.length === 1 ? "" : "s"}
                {activeVariants < variants.length && ` · ${variants.length - activeVariants} off`}
              </>
            )}
          </p>
        </div>
      </Link>
      {action && <div className="px-2 pt-1 pb-1">{action}</div>}
    </li>
  );
}
