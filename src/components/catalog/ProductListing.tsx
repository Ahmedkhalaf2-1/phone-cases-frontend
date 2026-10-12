import { ProductCard } from "@/components/catalog/ProductCard";
import { Pagination } from "@/components/catalog/Pagination";
import type { ProductListResult } from "@/lib/data/products";

/** Result count + product grid + pagination, shared by /search and collection pages. */
export function ProductListing({
  productList,
  buildHref,
  emptyMessage = "No cases match these filters yet.",
}: {
  productList: ProductListResult;
  buildHref: (page: number) => string;
  emptyMessage?: string;
}) {
  const { items, meta, source } = productList;

  return (
    <>
      <p className="my-4 text-sm text-muted-foreground">
        {meta.totalItems} result{meta.totalItems === 1 ? "" : "s"}
      </p>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} source={source} />
          ))}
        </div>
      )}

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        buildHref={buildHref}
      />

      {source === "demo" && (
        <p className="mt-6 text-xs text-muted-foreground">
          Demo data — sample products, not real inventory or prices.
        </p>
      )}
    </>
  );
}
