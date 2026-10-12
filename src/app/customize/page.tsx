import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CustomizeStudio } from "@/components/customize/CustomizeStudio";
import { CUSTOM_CASE_PRODUCT_SLUG } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";
import type { PublicVariant } from "@/lib/api/types";

export const metadata: Metadata = {
  title: "Design your case",
  description: "Upload your own photo and see it on a phone case.",
};

export default async function CustomizePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productParam } = await searchParams;
  const slug = productParam || CUSTOM_CASE_PRODUCT_SLUG;

  let result: Awaited<ReturnType<typeof getProductBySlug>> = null;
  let loadError = false;
  try {
    result = await getProductBySlug(slug);
  } catch {
    loadError = true;
  }

  const variants = (result?.product.variants ?? []) as PublicVariant[];
  const hasPersonalizable = variants.some((v) => v.isPersonalizable);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-6">
            <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">Design your case</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {result && productParam
                ? `Put your own photo on the ${result.product.name}.`
                : "Upload your own photo and see it on your case before you order."}
            </p>
          </header>

          {loadError ? (
            <EmptyState message="We couldn't load the case designer right now. Please try again in a moment." />
          ) : !result || !hasPersonalizable ? (
            <EmptyState
              message={
                productParam
                  ? "This case can't be personalized. Browse our collections for ready-made designs."
                  : "Custom cases are coming soon. In the meantime, browse our ready-made designs."
              }
            />
          ) : (
            <CustomizeStudio
              key={result.product.slug}
              productSlug={result.product.slug}
              productName={result.product.name}
              variants={variants}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-card bg-surface p-8 text-center shadow-card">
      <p className="text-muted-foreground">{message}</p>
      <Link
        href="/collections"
        className="mt-4 inline-block rounded-pill bg-ink px-6 py-3 text-sm font-medium text-white hover:bg-accent"
      >
        Browse collections
      </Link>
    </div>
  );
}
