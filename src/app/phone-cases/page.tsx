import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductFilters } from "@/components/catalog/ProductFilters";
import { Pagination } from "@/components/catalog/Pagination";
import { getProducts } from "@/lib/data/products";
import { getMoodCollections } from "@/lib/data/collections";
import { getPhoneModels } from "@/lib/data/phone-catalog";
import { getCaseTypes } from "@/lib/data/case-types";
import type { ProductSort } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Phone Cases",
};

const SORT_VALUES: ProductSort[] = ["newest", "price_asc", "price_desc"];

function parseSort(value: string | undefined): ProductSort | undefined {
  return SORT_VALUES.find((sort) => sort === value);
}

export default async function PhoneCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;

  const queryParams = {
    q: params.q || undefined,
    collection: params.collection || undefined,
    phoneModel: params.phoneModel || undefined,
    caseType: params.caseType || undefined,
    availableOnly: params.availableOnly === "true" ? true : undefined,
    sort: parseSort(params.sort),
    page,
  };

  const [productList, moodCollections, phoneModelsResult, caseTypesResult] =
    await Promise.all([
      getProducts(queryParams),
      getMoodCollections(),
      getPhoneModels(),
      getCaseTypes(),
    ]);

  function buildHref(nextPage: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
    }
    next.set("page", String(nextPage));
    return `/phone-cases?${next.toString()}`;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-6 font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">
            Phone cases
          </h1>

          <ProductFilters
            collections={moodCollections.collections}
            phoneModels={phoneModelsResult.models}
            caseTypes={caseTypesResult.caseTypes}
          />

          <p className="my-4 text-sm text-muted-foreground">
            {productList.meta.totalItems} result
            {productList.meta.totalItems === 1 ? "" : "s"}
          </p>

          {productList.items.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              No cases match these filters yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {productList.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  source={productList.source}
                />
              ))}
            </div>
          )}

          <Pagination
            page={productList.meta.page}
            totalPages={productList.meta.totalPages}
            buildHref={buildHref}
          />

          {productList.source === "demo" && (
            <p className="mt-6 text-xs text-muted-foreground">
              Demo data — sample products, not real inventory or prices.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
