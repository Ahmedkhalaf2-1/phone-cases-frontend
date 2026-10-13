import type { Metadata } from "next";
import localFont from "next/font/local";
import { CartProvider } from "@/lib/cart/CartProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SITE } from "@/config/site";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

// Inter (latin, variable) is self-hosted so builds never depend on reaching
// Google Fonts. The same file backs both the display and body variables.
const displayFont = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  variable: "--font-display",
  weight: "500 600",
  display: "swap",
});

const bodyFont = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
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
