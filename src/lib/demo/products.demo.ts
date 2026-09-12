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
 * Images point at `public/temp-reference/product-*.webp` — cropped
 * isolated slices of `refrenace.png`'s product photography, used only
 * because no real product photography exists yet (see
 * docs/FRONTEND_PROGRESS.md). Names and prices are placeholders too.
 */
export type DemoProduct = PublicProductDetail;

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

function demoImage(name: string) {
  return `/temp-reference/product-${name}.webp`;
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
    primaryImage: { url: demoImage("check"), altText: "Checkerboard-pattern phone case" },
    collections: [{ id: "demo-different", slug: "different", name: "Different" }],
    media: [
      {
        id: "demo-check-1",
        url: demoImage("check"),
        altText: "Checkerboard-pattern phone case",
        isPrimary: true,
        displayOrder: 0,
      },
    ],
    variants: buildVariants("check", 45000, "EGP"),
  },
  {
    id: "demo-cherry",
    slug: "cherry",
    name: "Cherry",
    description: "More you. A glossy cherry print.",
    currency: "EGP",
    effectivePriceFrom: 45000,
    isAvailable: true,
    primaryImage: { url: demoImage("cherry"), altText: "Glossy cherry-print phone case" },
    collections: [{ id: "demo-bold", slug: "bold", name: "Bold" }],
    media: [
      {
        id: "demo-cherry-1",
        url: demoImage("cherry"),
        altText: "Glossy cherry-print phone case",
        isPrimary: true,
        displayOrder: 0,
      },
    ],
    variants: buildVariants("cherry", 45000, "EGP", {
      unavailableFor: "galaxy-s24",
    }),
  },
  {
    id: "demo-orbit",
    slug: "orbit",
    name: "Orbit",
    description: "Good cases, better days. A quiet planetary scene.",
    currency: "EGP",
    effectivePriceFrom: 49500,
    isAvailable: true,
    primaryImage: { url: demoImage("orbit"), altText: "Planetary-scene phone case" },
    collections: [{ id: "demo-different", slug: "different", name: "Different" }],
    media: [
      {
        id: "demo-orbit-1",
        url: demoImage("orbit"),
        altText: "Planetary-scene phone case",
        isPrimary: true,
        displayOrder: 0,
      },
    ],
    variants: buildVariants("orbit", 49500, "EGP"),
  },
  {
    id: "demo-sage",
    slug: "sage",
    name: "Sage",
    description: "Quiet details. Strong character. A hand-drawn leaf.",
    currency: "EGP",
    effectivePriceFrom: 45000,
    isAvailable: true,
    primaryImage: { url: demoImage("sage"), altText: "Sage-green leaf-print phone case" },
    collections: [{ id: "demo-calm", slug: "calm", name: "Calm" }],
    media: [
      {
        id: "demo-sage-1",
        url: demoImage("sage"),
        altText: "Sage-green leaf-print phone case",
        isPrimary: true,
        displayOrder: 0,
      },
    ],
    variants: buildVariants("sage", 45000, "EGP"),
  },
];
