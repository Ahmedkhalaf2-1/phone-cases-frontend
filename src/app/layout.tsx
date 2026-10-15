import type { Metadata } from "next";
import { headers } from "next/headers";
import { CartProvider } from "@/lib/cart/CartProvider";
import { AppShell } from "@/components/layout/AppShell";
import { AnnouncementBar } from "@/components/bundles/AnnouncementBar";
import { getActiveBundleOffers } from "@/lib/data/bundles";
import { pickAnnouncementBanner } from "@/lib/bundles";
import { DIRECTION, type Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LocaleSync } from "@/i18n/LocaleSync";
import { getMessages } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/translate";
import { SITE } from "@/config/site";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

/** The admin dashboard is English-only and never follows the storefront language. */
async function resolveLocale(): Promise<Locale> {
  const scope = (await headers()).get("x-contrast-scope");
  return scope === "admin" ? "en" : getLocale();
}

/** "store" for customer pages, "admin" for the dashboard (font/direction scoping). */
async function resolveScope(): Promise<"store" | "admin"> {
  return (await headers()).get("x-contrast-scope") === "admin" ? "admin" : "store";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const { t } = createTranslator(locale, getMessages(locale));
  const title = `${SITE.brandName} — ${t("meta.titleSuffix")}`;
  const description = t("meta.description");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${SITE.brandName}` },
    description,
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE.brandName,
      title,
      description,
      locale: locale === "ar" ? "ar_EG" : "en_US",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Server-resolved; null (and nothing rendered) unless an admin has turned
  // the announcement banner on for a currently active bundle.
  const locale = await resolveLocale();
  const scope = await resolveScope();
  const messages = getMessages(locale);
  const i18n = createTranslator(locale, messages);
  const banner = pickAnnouncementBanner(await getActiveBundleOffers(), i18n);

  return (
    <html
      lang={locale}
      dir={DIRECTION[locale]}
      data-scope={scope}
      className="h-full"
    >
      <body className="min-h-full overflow-x-hidden bg-background text-foreground antialiased">
        <I18nProvider locale={locale} messages={messages}>
          <LocaleSync />
          <CartProvider>
            <AppShell announcement={banner ? <AnnouncementBar banner={banner} /> : null}>
              {children}
            </AppShell>
          </CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
