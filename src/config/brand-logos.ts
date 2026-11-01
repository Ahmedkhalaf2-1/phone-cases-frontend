/**
 * Built-in logos for well-known phone brands, used when a brand has no
 * uploaded logo. Files live in public/brand-logos and come from Simple
 * Icons (https://simpleicons.org, CC0). The logos themselves are the
 * trademarks of their owners and are only used to say which phones a case
 * fits. Brands without an entry here (e.g. Infinix, Realme, Redmi, POCO)
 * show their uploaded logo or their initial.
 */
const BUILT_IN = ["apple", "samsung", "honor", "huawei", "oppo", "xiaomi", "oneplus", "vivo", "motorola", "nokia", "google"];

/** Slugs that should reuse another brand's file. */
const ALIASES: Record<string, string> = {
  iphone: "apple",
  "google-pixel": "google",
  pixel: "google",
  "samsung-galaxy": "samsung",
  galaxy: "samsung",
  "one-plus": "oneplus",
};

export function builtInBrandLogo(slug: string): string | null {
  const key = ALIASES[slug] ?? slug;
  return BUILT_IN.includes(key) ? `/brand-logos/${key}.svg` : null;
}
