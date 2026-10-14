/**
 * Central place for copy/links that would otherwise be hardcoded across
 * multiple components. Swapping the brand name, nav, or footer links only
 * requires editing this file.
 */

export const SITE = {
  brandName: "Contrast",
} as const;

/** Route every not-yet-built destination points to, with an honest reason. */
export const NOT_AVAILABLE_ROUTE = "/coming-soon";

export interface NavLink {
  label: string;
  /** i18n key under `nav.*`; `label` stays as the English fallback/identity. */
  key: "newIn" | "collections" | "designYourCase" | "trackOrder" | "aboutUs" | "help" | "privacy" | "terms";
  href: string;
}

/**
 * The product /customize opens with when the customer arrives from the
 * main nav (not from a specific product's "Personalize this case" link).
 * It should be a blank case whose variants are marked personalizable in
 * the admin. Override with NEXT_PUBLIC_CUSTOM_CASE_PRODUCT_SLUG.
 */
export const CUSTOM_CASE_PRODUCT_SLUG =
  process.env.NEXT_PUBLIC_CUSTOM_CASE_PRODUCT_SLUG || "custom-case";

/** Primary header navigation. */
export const PRIMARY_NAV: NavLink[] = [
  { label: "New In", key: "newIn", href: "/search?sort=newest" },
  { label: "Collections", key: "collections", href: "/collections" },
  { label: "Design Your Case", key: "designYourCase", href: "/customize" },
  { label: "Track Order", key: "trackOrder", href: "/track" },
];

/**
 * Real CMS page routes (`/pages/<slug>`) — each renders the published
 * page if one exists, or an honest "not published yet" state if it
 * doesn't (see src/app/pages/[slug]/page.tsx). Slugs here are a
 * business decision, not something to invent: update them once the
 * shop owner publishes real About/Help/Privacy/Terms pages under
 * whatever slugs they choose in the admin Pages CMS.
 */
export const FOOTER_LINKS: NavLink[] = [
  { label: "About Us", key: "aboutUs", href: "/pages/about" },
  { label: "Help", key: "help", href: "/pages/help" },
  { label: "Privacy Policy", key: "privacy", href: "/pages/privacy-policy" },
  { label: "Terms & Conditions", key: "terms", href: "/pages/terms-and-conditions" },
];

/**
 * Real InstaPay transfer recipient, provided directly by the shop owner.
 * `whatsappNumber` is where a customer must send a screenshot of their
 * transfer after paying — the receipt upload alone doesn't notify anyone,
 * so checkout tells the customer to message it too.
 */
export const INSTAPAY_RECIPIENT: { name: string; identifier: string; whatsappNumber: string } | null =
  {
    name: SITE.brandName,
    identifier: "01030750304",
    whatsappNumber: "01030750304",
  };
