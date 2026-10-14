import { LinkPending } from "@/components/motion/LinkPending";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getI18n } from "@/i18n/server";
import { getMoodCollections } from "@/lib/data/collections";
import { getProducts } from "@/lib/data/products";
import { getCollectionCover } from "@/config/collection-covers";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("catalog.collectionsTitle") };
}

export default async function CollectionsPage() {
  const { t, tn } = await getI18n();
  const { collections } = await getMoodCollections();

  // A few cases per collection for the tile preview, plus its total count.
  const tiles = (
    await Promise.all(
      collections.map(async (collection) => {
        const products = await getProducts({
          collection: collection.slug,
          page: 1,
          pageSize: 3,
        });
        return {
          collection,
          previews: products.items,
          total: products.meta.totalItems,
        };
      }),
    )
  ).filter((tile) => tile.total > 0);

  return (
    <>
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-8">
            <p className="mb-1 text-xs font-medium tracking-tight text-muted-foreground">
              {tn("catalog.collectionsCount", tiles.length)}
            </p>
            <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">
              {t("catalog.collectionsTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("catalog.collectionsIntro")}
            </p>
          </header>

          {tiles.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              {t("catalog.noCollections")}
            </p>
          ) : (
            <div data-motion-stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map(({ collection, previews, total }, tileIndex) => {
                const imageLoading = tileIndex < 3 ? "eager" : "lazy";
                const cover = getCollectionCover(collection.slug, collection.coverImage);
                return (
                  <Link
                    key={collection.id}
                    href={`/collections/${collection.slug}`}
                    className="sf-nav-target group flex flex-col rounded-card bg-surface p-2 shadow-card transition-transform duration-[var(--sf-dur-normal)] ease-[var(--sf-ease)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <LinkPending />
                    {cover ? (
                      <div className="aspect-[16/10] overflow-hidden rounded-card-inner bg-surface">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover.src}
                          alt=""
                          loading={imageLoading}
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-[var(--sf-dur-slow)] ease-[var(--sf-ease)] group-hover:scale-[1.03] motion-reduce:transform-none"
                        />
                      </div>
                    ) : (
                      <div className="grid aspect-[16/10] grid-cols-3 gap-1 overflow-hidden rounded-card-inner bg-surface">
                        {[0, 1, 2].map((index) => {
                          const image = previews[index]?.primaryImage;
                          return (
                            <div
                              key={index}
                              className="flex items-center justify-center overflow-hidden"
                            >
                              {image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={image.url}
                                  alt=""
                                  loading={imageLoading}
                                  decoding="async"
                                  className="h-full w-full object-contain transition-transform duration-[var(--sf-dur-slow)] ease-[var(--sf-ease)] group-hover:scale-[1.03] motion-reduce:transform-none"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-end justify-between gap-3 px-3 pb-3 pt-4">
                      <div className="min-w-0">
                        <h2 className="font-display text-2xl tracking-tighter text-ink">
                          {collection.name}
                        </h2>
                        {collection.description && (
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {collection.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          {tn("catalog.designs", total)}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill border border-border text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
