import { getI18n } from "@/i18n/server";
import { InfiniteProductGrid } from "@/components/catalog/InfiniteProductGrid";
import { Pagination } from "@/components/catalog/Pagination";
import type { ProductListResult } from "@/lib/data/products";

/**
 * Result count + product grid shared by /search and collection pages. The
 * first page is server-rendered; the rest loads as the customer scrolls.
 * Plain pagination links stay available without JavaScript.
 */
export async function ProductListing({
  productList,
  query,
  buildHref,
  emptyMessage,
}: {
  productList: ProductListResult;
  /** Active filters, used to fetch the following pages. */
  query: Record<string, string | undefined>;
  buildHref: (page: number) => string;
  emptyMessage?: string;
}) {
  const { t, tn } = await getI18n();
  const { meta, source } = productList;
  const queryKey = JSON.stringify(query);

  return (
    <>
      <InfiniteProductGrid
        key={queryKey}
        initial={productList}
        query={query}
        countLabel={tn("catalog.results", meta.totalItems)}
        emptyMessage={emptyMessage ?? t("catalog.noMatch")}
      />

      <noscript>
        <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
      </noscript>

      {source === "demo" && (
        <p className="mt-6 text-xs text-muted-foreground">{t("catalog.demoProducts")}</p>
      )}
    </>
  );
}
