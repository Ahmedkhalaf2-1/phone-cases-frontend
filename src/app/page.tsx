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
  const [collectionsResult, featuredProducts, homepageSections] = await Promise.all([
    getMoodCollections(),
    getFeaturedProducts(4),
    getEnabledHomepageSections(),
  ]);

  // One row per collection (Anime, Cars, …), each with its first few cases.
  const collectionRows = await Promise.all(
    collectionsResult.collections.map(async (collection) => ({
      collection,
      products: await getProducts({ collection: collection.slug, page: 1, pageSize: 10 }),
    })),
  );

  const promoStrips = homepageSections.filter((s) => s.type === "PROMO_STRIP");
  const banners = homepageSections.filter((s) => s.type === "BANNER");

  return (
    <>
      <CmsHomepageSections sections={promoStrips} />
      <SiteHeader />
      <main className="flex-1">
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
          />
        ))}
        <CmsHomepageSections sections={banners} />
        <FeaturedProducts
          products={featuredProducts.products}
          source={featuredProducts.source}
        />
      </main>
      <SiteFooter />
    </>
  );
}
