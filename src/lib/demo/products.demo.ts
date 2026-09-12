import type {
  PublicProductDetail,
  PublicVariant,
} from "@/lib/api/types";
import { DEMO_PHONE_MODELS } from "@/lib/demo/phone-models.demo";
import { DEMO_CASE_TYPES } from "@/lib/demo/case-types.demo";

/**
 * DEMO FIXTURE — not real inventory.
 *
 * Shaped exactly like `PublicProductDetail` from the verified backend
 * contract so swapping to live data requires no component changes.
 * Names, artwork keys, and prices are placeholders for this milestone;
 * see docs/FRONTEND_PROGRESS.md.
 */
export interface DemoProduct extends PublicProductDetail {
  /** Key into the local illustration set (src/components/graphics). Demo-only field. */
  artwork: "check" | "cherry" | "orbit" | "sage";
}

const [iphone15Pro, iphone15, iphone14, galaxyS24] = DEMO_PHONE_MODELS;
const [silicone, tough] = DEMO_CASE_TYPES;

function buildVariants(
  productSlug: string,
  basePrice: number,
  currency: string,
  options: { unavailableFor?: string } = {},
): PublicVariant[] {
  const models = [iphone15Pro, iphone15, iphone14, galaxyS24];
  const caseTypes = [silicone, tough];
  const variants: PublicVariant[] = [];

  for (const model of models) {
    for (const caseType of caseTypes) {
      const surcharge = caseType.id === tough.id ? 5000 : 0;
      variants.push({
        id: `demo-${productSlug}-${model.slug}-${caseType.slug}`,
        sku: `${productSlug}-${model.slug}-${caseType.slug}`.toUpperCase(),
        price: basePrice + surcharge,
        compareAtPrice: null,
        currency,
        isAvailable: model.slug !== options.unavailableFor,
        thumbnail: null,
        phoneModel: {
          id: model.id,
          slug: model.slug,
          name: model.name,
          brand: model.brand,
        },
        caseType: {
          id: caseType.id,
          slug: caseType.slug,
          name: caseType.name,
        },
      });
    }
  }

  return variants;
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "demo-check",
    slug: "check",
    name: "Check",
    description:
      "A bold checkerboard pattern. Cases for a brighter you.",
    currency: "EGP",
    effectivePriceFrom: 45000,
    isAvailable: true,
    primaryImage: null,
    collections: [{ id: "demo-different", slug: "different", name: "Different" }],
    media: [
      { id: "demo-check-1", url: "", altText: "Check case, front", isPrimary: true, displayOrder: 0 },
      { id: "demo-check-2", url: "", altText: "Check case, angle", isPrimary: false, displayOrder: 1 },
    ],
    variants: buildVariants("check", 45000, "EGP"),
    artwork: "check",
  },
  {
    id: "demo-cherry",
    slug: "cherry",
    name: "Cherry",
    description: "More you. A glossy cherry print.",
    currency: "EGP",
    effectivePriceFrom: 45000,
    isAvailable: true,
    primaryImage: null,
    collections: [{ id: "demo-bold", slug: "bold", name: "Bold" }],
    media: [
      { id: "demo-cherry-1", url: "", altText: "Cherry case, front", isPrimary: true, displayOrder: 0 },
      { id: "demo-cherry-2", url: "", altText: "Cherry case, angle", isPrimary: false, displayOrder: 1 },
    ],
    variants: buildVariants("cherry", 45000, "EGP", {
      unavailableFor: "galaxy-s24",
    }),
    artwork: "cherry",
  },
  {
    id: "demo-orbit",
    slug: "orbit",
    name: "Orbit",
    description: "Good cases, better days. A quiet planetary scene.",
    currency: "EGP",
    effectivePriceFrom: 49500,
    isAvailable: true,
    primaryImage: null,
    collections: [{ id: "demo-different", slug: "different", name: "Different" }],
    media: [
      { id: "demo-orbit-1", url: "", altText: "Orbit case, front", isPrimary: true, displayOrder: 0 },
      { id: "demo-orbit-2", url: "", altText: "Orbit case, angle", isPrimary: false, displayOrder: 1 },
    ],
    variants: buildVariants("orbit", 49500, "EGP"),
    artwork: "orbit",
  },
  {
    id: "demo-sage",
    slug: "sage",
    name: "Sage",
    description: "Quiet details. Strong character. A hand-drawn leaf.",
    currency: "EGP",
    effectivePriceFrom: 45000,
    isAvailable: true,
    primaryImage: null,
    collections: [{ id: "demo-calm", slug: "calm", name: "Calm" }],
    media: [
      { id: "demo-sage-1", url: "", altText: "Sage case, front", isPrimary: true, displayOrder: 0 },
      { id: "demo-sage-2", url: "", altText: "Sage case, angle", isPrimary: false, displayOrder: 1 },
    ],
    variants: buildVariants("sage", 45000, "EGP"),
    artwork: "sage",
  },
];
