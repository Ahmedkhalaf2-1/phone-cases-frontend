import { getLocale } from "@/i18n/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/home/Hero";
import { CollectionProductsSection } from "@/components/home/CollectionProductsSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { CmsHomepageSections } from "@/components/home/CmsHomepageSections";
import { getFeaturedProducts, getProducts } from "@/lib/data/products";
import { getMoodCollections } from "@/lib/data/collections";
import { getEnabledHomepageSections } from "@/lib/data/homepage-sections";

export default async function Home() {
  const locale = await getLocale();
  const [collectionsResult, featuredProducts, homepageSections] = await Promise.all([
    getMoodCollections(locale),
    getFeaturedProducts(4, locale),
    getEnabledHomepageSections(locale),
  ]);

  // One row per collection (Anime, Cars, …), each with its first few cases.
  const collectionRows = await Promise.all(
    collectionsResult.collections.map(async (collection) => ({
      collection,
      products: await getProducts({ collection: collection.slug, page: 1, pageSize: 10, locale }),
    })),
  );

  // A product can appear in several rails (and in "Caught our eye"). Its
  // shared-image view-transition name must exist once per page, so the
  // first card on the page claims it and later ones opt out.
  const claimed = new Set<string>();
  const claim = (products: { slug: string }[]) =>
    new Set(
      products
        .filter((product) => !claimed.has(product.slug) && (claimed.add(product.slug), true))
        .map((product) => product.slug),
    );
  const rowSharedSlugs = collectionRows.map(({ products }) => claim(products.items));
  const featuredSharedSlugs = claim(featuredProducts.products);

  const promoStrips = homepageSections.filter((s) => s.type === "PROMO_STRIP");
  const banners = homepageSections.filter((s) => s.type === "BANNER");

  return (
    <>
      <CmsHomepageSections sections={promoStrips} />
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <Hero />
        {collectionRows.map(({ collection, products }, index) => (
          <CollectionProductsSection
            key={collection.id}
            name={collection.name}
            slug={collection.slug}
            description={collection.description}
            products={products.items}
            totalItems={products.meta.totalItems}
            source={products.source}
            eagerImageCount={index === 0 ? 5 : 0}
            sharedImageSlugs={rowSharedSlugs[index]}
          />
        ))}
        <CmsHomepageSections sections={banners} />
        <FeaturedProducts
          products={featuredProducts.products}
          source={featuredProducts.source}
          sharedImageSlugs={featuredSharedSlugs}
        />
      </main>
      <SiteFooter />
    </>
  );
}
