import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CartProvider } from "@/lib/cart/CartProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SITE } from "@/config/site";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const displayFont = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const description = "A design you choose. A style you own.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.brandName} — Phone Cases`,
    template: `%s — ${SITE.brandName}`,
  },
  description,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: SITE.brandName,
    title: `${SITE.brandName} — Phone Cases`,
    description,
  },
  twitter: {
    card: "summary",
    title: `${SITE.brandName} — Phone Cases`,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} h-full`}
    >
      <body className="min-h-full overflow-x-hidden bg-background text-foreground antialiased">
        <CartProvider>
          <AppShell>{children}</AppShell>
        </CartProvider>
      </body>
    </html>
  );
}
