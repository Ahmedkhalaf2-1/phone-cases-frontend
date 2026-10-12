import Link from "next/link";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_STYLE,
  priceSummary,
  primaryImageUrl,
} from "@/lib/admin/product-display";
import type { AdminProduct } from "@/lib/admin/types";

/**
 * Image-led product tile for admin grids — staff recognise a design from
 * its picture long before its name.
 */
export function AdminProductCard({
  product,
  href,
  action,
}: {
  product: AdminProduct;
  href: string;
  /** Optional extra control under the Edit button (e.g. "Remove from collection"). */
  action?: React.ReactNode;
}) {
  const image = primaryImageUrl(product);
  const price = priceSummary(product);
  const imageCount = product.media?.length ?? 0;

  return (
    <li className="group flex flex-col rounded-card bg-surface p-2 shadow-card">
      <Link
        href={href}
        className="relative block aspect-square overflow-hidden rounded-card-inner bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-8">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 18l5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            No image yet
          </span>
        )}
        <span
          className={`absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRODUCT_STATUS_STYLE[product.status]}`}
        >
          {PRODUCT_STATUS_LABEL[product.status]}
        </span>
        {imageCount > 1 && (
          <span className="absolute end-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-ink">
            {imageCount} photos
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-2 pt-3 pb-1">
        <p className="line-clamp-2 font-semibold leading-snug text-ink">{product.nameEn}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {price ?? <span className="text-amber-700">No price yet</span>}
        </p>
        <div className="mt-auto flex flex-col gap-1.5 pt-3">
          <Link
            href={href}
            className="rounded-pill bg-ink px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Edit product
          </Link>
          {action}
        </div>
      </div>
    </li>
  );
}
