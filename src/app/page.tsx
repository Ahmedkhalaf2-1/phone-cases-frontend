import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/home/Hero";
import { PhoneSelector } from "@/components/home/PhoneSelector";
import { CollectionsSection } from "@/components/home/CollectionsSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { getPhoneModels } from "@/lib/data/phone-catalog";
import { getMoodCollections } from "@/lib/data/collections";
import { getFeaturedProducts } from "@/lib/data/products";

export default async function Home() {
  const [phoneModels, moodCollections, featuredProducts] = await Promise.all([
    getPhoneModels(),
    getMoodCollections(),
    getFeaturedProducts(4),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <PhoneSelector models={phoneModels.models} source={phoneModels.source} />
        <CollectionsSection collections={moodCollections.collections} />
        <FeaturedProducts
          products={featuredProducts.products}
          source={featuredProducts.source}
        />
      </main>
      <SiteFooter />
    </>
  );
}
