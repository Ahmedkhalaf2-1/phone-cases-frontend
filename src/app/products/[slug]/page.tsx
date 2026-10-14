import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { getProductBySlug } from "@/lib/data/products";
import { getActiveBundleOffers } from "@/lib/data/bundles";
import { offerForProduct, productNote } from "@/lib/bundles";
import { getI18n } from "@/i18n/server";
import { getMoodCollections } from "@/lib/data/collections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getI18n();
  const result = await getProductBySlug(slug);
  return { title: result ? result.product.name : t("common.notFoundTitle") };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const i18n = await getI18n();
  const result = await getProductBySlug(slug);

  if (!result) notFound();

  const { product, source } = result;
  // Product copy stays as stored; only the collection name follows the language.
  const firstCollection = product.collections[0];
  const collectionName = firstCollection
    ? ((await getMoodCollections(i18n.locale)).collections.find(
        (c) => c.slug === firstCollection.slug,
      )?.name ?? firstCollection.name)
    : null;
  const bundleOffer = offerForProduct(await getActiveBundleOffers(), product.slug);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-10 max-sm:pt-4 max-sm:pb-8 sm:px-6 lg:px-8">
          <nav
            data-motion="fade"
            aria-label={i18n.t("product.breadcrumb")}
            // Mobile: one tight, lighter line (the current page truncates
            // instead of wrapping); links keep a 36px hit area via padding
            // that is cancelled by negative margin, so layout is unaffected.
            className="mb-6 text-sm text-muted-foreground max-sm:mb-3 max-sm:flex max-sm:items-center max-sm:gap-1.5 max-sm:text-[13px] max-sm:[&_a]:-my-2 max-sm:[&_a]:shrink-0 max-sm:[&_a]:py-2"
          >
            <Link href="/collections" className="hover:text-accent">
              {i18n.t("nav.collections")}
            </Link>{" "}
            /{" "}
            {product.collections[0] && (
              <>
                <Link
                  href={`/collections/${product.collections[0].slug}`}
                  className="hover:text-accent"
                >
                  {collectionName}
                </Link>{" "}
                /{" "}
              </>
            )}
            <span aria-current="page" className="text-ink max-sm:min-w-0 max-sm:truncate max-sm:text-ink/70">
              {product.name}
            </span>
          </nav>

          <ProductGallery
            product={product}
            source={source}
            bundleNote={bundleOffer ? productNote(bundleOffer, i18n) : undefined}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
