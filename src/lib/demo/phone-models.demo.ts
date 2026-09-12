import type { PhoneModel } from "@/lib/api/types";

/**
 * DEMO FIXTURE — not the real supported-model list.
 * Shaped like `PhoneModel` from the verified backend contract. Intentionally
 * includes more than one brand/model so the UI never assumes every visitor
 * owns an iPhone 15.
 */
export const DEMO_PHONE_MODELS: PhoneModel[] = [
  {
    id: "demo-iphone-15-pro",
    slug: "iphone-15-pro",
    name: "iPhone 15 Pro",
    releaseYear: 2023,
    brand: { id: "demo-apple", slug: "apple", name: "Apple" },
  },
  {
    id: "demo-iphone-15",
    slug: "iphone-15",
    name: "iPhone 15",
    releaseYear: 2023,
    brand: { id: "demo-apple", slug: "apple", name: "Apple" },
  },
  {
    id: "demo-iphone-14",
    slug: "iphone-14",
    name: "iPhone 14",
    releaseYear: 2022,
    brand: { id: "demo-apple", slug: "apple", name: "Apple" },
  },
  {
    id: "demo-galaxy-s24",
    slug: "galaxy-s24",
    name: "Galaxy S24",
    releaseYear: 2024,
    brand: { id: "demo-samsung", slug: "samsung", name: "Samsung" },
  },
  {
    id: "demo-galaxy-s23",
    slug: "galaxy-s23",
    name: "Galaxy S23",
    releaseYear: 2023,
    brand: { id: "demo-samsung", slug: "samsung", name: "Samsung" },
  },
  {
    id: "demo-pixel-8",
    slug: "pixel-8",
    name: "Pixel 8",
    releaseYear: 2023,
    brand: { id: "demo-google", slug: "google", name: "Google" },
  },
];
