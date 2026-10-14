import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getStaticPage } from "@/lib/data/pages";
import { getI18n } from "@/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStaticPage(slug);
  const { t } = await getI18n();
  return { title: page ? page.title : t("pages.pageNotAvailable") };
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getStaticPage(slug);
  const { t } = await getI18n();

  return (
    <>
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          {page ? (
            <>
              <h1 className="font-display text-4xl tracking-tighter text-ink">
                {page.title}
              </h1>
              <div className="mt-6 whitespace-pre-wrap text-ink">{page.body}</div>
            </>
          ) : (
            <div className="py-16 text-center">
              <h1 className="font-display text-3xl tracking-tighter text-ink">
                {t("pages.notPublishedTitle")}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {t("pages.notPublishedBody", { slug })}
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent"
              >
                {t("pages.backHome")}
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
