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
  { label: "Collections", href: "#collections" },
  { label: "Track Order", href: "/track" },
];

export const FOOTER_LINKS: NavLink[] = [
  { label: "About Us", href: NOT_AVAILABLE_ROUTE },
  { label: "Help", href: NOT_AVAILABLE_ROUTE },
  { label: "Privacy Policy", href: NOT_AVAILABLE_ROUTE },
  { label: "Terms & Conditions", href: NOT_AVAILABLE_ROUTE },
];
