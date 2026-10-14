import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ProductFilters } from "@/components/catalog/ProductFilters";
import { ProductListing } from "@/components/catalog/ProductListing";
import { getProducts } from "@/lib/data/products";
import { getI18n } from "@/i18n/server";
import { getMoodCollections } from "@/lib/data/collections";
import { getPhoneModels } from "@/lib/data/phone-catalog";
import { getCaseTypes } from "@/lib/data/case-types";
import {
  pageHrefBuilder,
  parseCatalogParams,
  type CatalogSearchParams,
} from "@/lib/catalog-params";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("catalog.searchTitle") };
}

/**
 * Product search results — where the header search, "Find your phone" and
 * "New In" land. Browsing by theme lives on /collections.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const { t, locale } = await getI18n();

  const [productList, collectionsResult, phoneModelsResult, caseTypesResult] =
    await Promise.all([
      getProducts({
        ...parseCatalogParams(params),
        collection: params.collection || undefined,
      }),
      getMoodCollections(locale),
      getPhoneModels(),
      getCaseTypes(),
    ]);

  const phoneModel = phoneModelsResult.models.find(
    (model) => model.slug === params.phoneModel,
  );
  const heading = params.q
    ? t("catalog.resultsFor", { query: params.q })
    : phoneModel
      ? t("catalog.casesFor", { model: `${phoneModel.brand.name} ${phoneModel.name}` })
      : params.sort === "newest"
        ? t("catalog.newIn")
        : t("catalog.searchTitle");

  return (
    <>
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-6 font-display text-4xl tracking-tighter text-ink sm:text-5xl">
            {heading}
          </h1>

          <ProductFilters
            basePath="/search"
            collections={collectionsResult.collections}
            phoneModels={phoneModelsResult.models}
            caseTypes={caseTypesResult.caseTypes}
          />

          <ProductListing
            productList={productList}
            buildHref={pageHrefBuilder("/search", params)}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
