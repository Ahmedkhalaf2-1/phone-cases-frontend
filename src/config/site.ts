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
  href: string;
}

/** Primary header navigation. */
export const PRIMARY_NAV: NavLink[] = [
  { label: "New In", href: "/phone-cases?sort=newest" },
  { label: "Phone Cases", href: "/phone-cases" },
  // Absolute path + hash (not a bare "#collections") so this works from
  // any page, not just when already on the homepage.
  { label: "Collections", href: "/#collections" },
  { label: "Track Order", href: "/track" },
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
  { label: "About Us", href: "/pages/about" },
  { label: "Help", href: "/pages/help" },
  { label: "Privacy Policy", href: "/pages/privacy-policy" },
  { label: "Terms & Conditions", href: "/pages/terms-and-conditions" },
];

/**
 * No InstaPay recipient (phone/name) is configured anywhere in the
 * backend (verified against its source — no env var, settings endpoint,
 * or seed data exposes one). Rather than invent a recipient, checkout
 * shows an honest "not configured" state and disables the upload step
 * while this is null. Fill this in once the shop owner provides real
 * transfer details — a single edit here, not duplicated per component.
 */
export const INSTAPAY_RECIPIENT: { name: string; identifier: string } | null = null;
