import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { getProductBySlug } from "@/lib/data/products";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProductBySlug(slug);
  return { title: result ? result.product.name : "Product not found" };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getProductBySlug(slug);

  if (!result) notFound();

  const { product, source } = result;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
            <Link href="/phone-cases" className="hover:text-accent">
              Phone cases
            </Link>{" "}
            / <span className="text-ink">{product.name}</span>
          </nav>

          <ProductGallery product={product} source={source} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
