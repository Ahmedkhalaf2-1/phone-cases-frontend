import { getI18n } from "@/i18n/server";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Pagination } from "@/components/catalog/Pagination";
import type { ProductListResult } from "@/lib/data/products";

/** Result count + product grid + pagination, shared by /search and collection pages. */
export async function ProductListing({
  productList,
  buildHref,
  emptyMessage,
}: {
  productList: ProductListResult;
  buildHref: (page: number) => string;
  emptyMessage?: string;
}) {
  const { t, tn } = await getI18n();
  const { items, meta, source } = productList;

  return (
    <>
      <p className="my-4 text-sm text-muted-foreground">
        {tn("catalog.results", meta.totalItems)}
      </p>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {emptyMessage ?? t("catalog.noMatch")}
        </p>
      ) : (
        <div data-motion-stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              source={source}
              imageLoading={index < 4 ? "eager" : "lazy"}
            />
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
          {t("catalog.demoProducts")}
        </p>
      )}
    </>
  );
}
