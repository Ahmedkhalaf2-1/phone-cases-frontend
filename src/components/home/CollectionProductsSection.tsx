import Link from "next/link";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductRail } from "@/components/home/ProductRail";
import type { PublicProductSummary } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

/** One homepage rail per collection: heading, its cases, and a "View all" card. */
export function CollectionProductsSection({
  name,
  slug,
  description,
  products,
  totalItems,
  source,
}: {
  name: string;
  slug: string;
  description?: string | null;
  products: (PublicProductSummary | DemoProduct)[];
  totalItems: number;
  source: "demo" | "live";
}) {
  if (products.length === 0) return null;

  const headingId = `collection-${slug}-heading`;
  const href = `/collections/${slug}`;
  const hasMore = totalItems > products.length;

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium tracking-tight text-muted-foreground">
            {totalItems} design{totalItems === 1 ? "" : "s"}
          </p>
          <h2
            id={headingId}
            className="font-display text-3xl tracking-tighter text-ink sm:text-4xl"
          >
            {name}
          </h2>
          {description && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-xs font-medium tracking-tight text-ink shadow-soft transition-colors hover:border-ink hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm"
        >
          View all
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>

      <ProductRail label={`${name} phone cases`}>
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]"
          >
            <ProductCard product={product} source={source} />
          </div>
        ))}

        {hasMore && (
          <Link
            href={href}
            className="group flex w-[46%] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-card border border-dashed border-cool-stone bg-surface/60 p-6 text-center transition-colors hover:border-accent hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-[31%] lg:w-[23%] xl:w-[19%]"
          >
            <span className="flex size-12 items-center justify-center rounded-pill bg-ink text-lg text-white transition-colors group-hover:bg-accent">
              →
            </span>
            <span className="font-display text-xl tracking-tighter text-ink">
              See all {totalItems}
            </span>
            <span className="text-sm text-muted-foreground">{name}</span>
          </Link>
        )}
      </ProductRail>
    </section>
  );
}
