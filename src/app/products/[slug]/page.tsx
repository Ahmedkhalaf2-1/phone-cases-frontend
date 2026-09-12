import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VariantPicker } from "@/components/catalog/VariantPicker";
import { PhoneCaseIllustration } from "@/components/graphics/PhoneCaseIllustration";
import { getProductBySlug } from "@/lib/data/products";
import type { PublicProductDetail } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

function isDemoProduct(
  product: PublicProductDetail | DemoProduct,
): product is DemoProduct {
  return "artwork" in product;
}

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
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
            <Link href="/phone-cases" className="hover:text-accent">
              Phone cases
            </Link>{" "}
            / <span className="text-ink">{product.name}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="aspect-square overflow-hidden rounded-sm bg-surface">
              {isDemoProduct(product) ? (
                <PhoneCaseIllustration
                  artwork={product.artwork}
                  className="mx-auto h-full max-h-[420px] py-8"
                />
              ) : product.media[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.media[0].url}
                  alt={product.media[0].altText ?? product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No image
                </div>
              )}
            </div>

            <div>
              <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">
                {product.name}
              </h1>
              {product.description && (
                <p className="mt-3 max-w-md text-muted-foreground">
                  {product.description}
                </p>
              )}

              {product.collections.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.collections.map((collection) => (
                    <Link
                      key={collection.id}
                      href={`/phone-cases?collection=${collection.slug}`}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold tracking-wide text-ink uppercase hover:border-accent hover:text-accent"
                    >
                      {collection.name}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-8">
                <VariantPicker variants={product.variants} />
              </div>

              {source === "demo" && (
                <p className="mt-6 text-xs text-muted-foreground">
                  Demo data — sample product, not real inventory or pricing.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
