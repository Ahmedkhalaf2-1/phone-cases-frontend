import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ProductFilters } from "@/components/catalog/ProductFilters";
import { ProductListing } from "@/components/catalog/ProductListing";
import { getProducts } from "@/lib/data/products";
import type { Locale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { getMoodCollections } from "@/lib/data/collections";
import { getPhoneModels } from "@/lib/data/phone-catalog";
import { getCaseTypes } from "@/lib/data/case-types";
import { getCollectionCover } from "@/config/collection-covers";
import {
  pageHrefBuilder,
  parseCatalogParams,
  type CatalogSearchParams,
} from "@/lib/catalog-params";

async function findCollection(slug: string, locale: Locale) {
  const { collections } = await getMoodCollections(locale);
  return collections.find((collection) => collection.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const collection = await findCollection((await params).slug, locale);
  return { title: collection?.name ?? t("catalog.collectionFallback") };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { t, locale } = await getI18n();
  const collection = await findCollection(slug, locale);
  if (!collection) notFound();

  const basePath = `/collections/${collection.slug}`;
  const cover = getCollectionCover(collection.slug, collection.coverImage);

  const [productList, phoneModelsResult, caseTypesResult] = await Promise.all([
    getProducts({ ...parseCatalogParams(query), collection: collection.slug }),
    getPhoneModels(),
    getCaseTypes(),
  ]);

  return (
    <>
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label={t("product.breadcrumb")} className="mb-6 text-sm text-muted-foreground">
            <Link href="/collections" className="hover:text-accent">
              {t("catalog.collectionsTitle")}
            </Link>{" "}
            / <span className="text-ink">{collection.name}</span>
          </nav>

          {cover ? (
            <header className="relative mb-8 aspect-[16/10] overflow-hidden rounded-card bg-ink shadow-card sm:aspect-[2/1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover.src}
                alt=""
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover ${
                  cover.position === "top" ? "object-top" : "object-center"
                }`}
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                <h1 className="font-display text-4xl tracking-tighter text-white sm:text-6xl">
                  {collection.name}
                </h1>
                {collection.description && (
                  <p className="mt-2 text-sm text-white/80 sm:text-base">
                    {collection.description}
                  </p>
                )}
              </div>
            </header>
          ) : (
            <header className="mb-6">
              <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {collection.description}
                </p>
              )}
            </header>
          )}

          <ProductFilters
            basePath={basePath}
            phoneModels={phoneModelsResult.models}
            caseTypes={caseTypesResult.caseTypes}
          />

          <ProductListing
            productList={productList}
            query={{ ...query, collection: collection.slug, page: undefined }}
            buildHref={pageHrefBuilder(basePath, query)}
            emptyMessage={t("catalog.noMatchCollection", { name: collection.name })}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
