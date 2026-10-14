import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getI18n } from "@/i18n/server";
import { CustomizeStudio } from "@/components/customize/CustomizeStudio";
import { CUSTOM_CASE_PRODUCT_SLUG } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";
import type { PublicVariant } from "@/lib/api/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("customize.title"), description: t("customize.description") };
}

export default async function CustomizePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productParam } = await searchParams;
  const { t } = await getI18n();
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
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-6">
            <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">{t("customize.title")}</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {result && productParam
                ? t("customize.introProduct", { name: result.product.name })
                : t("customize.introDefault")}
            </p>
          </header>

          {loadError ? (
            <EmptyState message={t("customize.loadError")} browse={t("customize.browse")} />
          ) : !result || !hasPersonalizable ? (
            <EmptyState
              browse={t("customize.browse")}
              message={
                productParam ? t("customize.notPersonalizable") : t("customize.comingSoon")
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

function EmptyState({ message, browse }: { message: string; browse: string }) {
  return (
    <div className="rounded-card bg-surface p-8 text-center shadow-card">
      <p className="text-muted-foreground">{message}</p>
      <Link
        href="/collections"
        className="mt-4 inline-block rounded-pill bg-ink px-6 py-3 text-sm font-medium text-white hover:bg-accent"
      >
        {browse}
      </Link>
    </div>
  );
}
