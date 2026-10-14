import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.comingSoonTitle") };
}

export default async function ComingSoonPage() {
  const { t } = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-24 text-center sm:px-6">
        <div className="max-w-md">
          <h1 className="font-display text-4xl tracking-tighter text-ink">
            {t("pages.comingSoonTitle")}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {t("pages.comingSoonBody")}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t("pages.backHome")}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
