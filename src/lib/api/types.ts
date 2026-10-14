/**
 * Types mirror the verified public contract of phone-cases-backend
 * (see docs/FRONTEND_PROGRESS.md for the exact source files inspected).
 * Only fields the homepage actually uses are declared.
 */

export type Locale = "en" | "ar";

export interface ApiImage {
  url: string;
  altText: string | null;
}

export interface CollectionRef {
  id: string;
  slug: string;
  name: string;
}

export interface PublicProductSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currency: string;
  effectivePriceFrom: number | null;
  isAvailable: boolean;
  primaryImage: ApiImage | null;
  collections: CollectionRef[];
}

export type HomepageSectionType = "BANNER" | "PROMO_STRIP";

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  displayOrder: number;
  media: ApiImage | null;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PhoneBrand {
  id: string;
  slug: string;
  name: string;
}

export interface PhoneModel {
  id: string;
  slug: string;
  name: string;
  releaseYear: number | null;
  brand: PhoneBrand;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Admin-uploaded cover — not returned by the backend yet (see collection-covers.ts). */
  coverImage?: { url: string; altText: string | null } | null;
}

export interface CaseType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface PublicVariantPhoneModel {
  id: string;
  slug: string;
  name: string;
  brand: PhoneBrand;
}

export interface PublicVariantCaseType {
  id: string;
  slug: string;
  name: string;
}

export interface PublicVariant {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  isAvailable: boolean;
  thumbnail: ApiImage | null;
  /** The customer can upload their own image for this variant (see /customize). */
  isPersonalizable?: boolean;
  /** Surcharge (minor units) added to `price` when a custom design is attached. */
  customizationPrice?: number;
  phoneModel: PublicVariantPhoneModel | null;
  caseType: PublicVariantCaseType | null;
}

export interface ProductMedia {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  displayOrder: number;
}

export interface PublicProductDetail extends PublicProductSummary {
  media: ProductMedia[];
  variants: PublicVariant[];
}

export type ProductSort = "newest" | "price_asc" | "price_desc";

/** Query params accepted by GET /products (see docs/FRONTEND_PROGRESS.md). */
export interface ProductQueryParams {
  q?: string;
  collection?: string;
  phoneModel?: string;
  caseType?: string;
  priceMin?: number;
  priceMax?: number;
  availableOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  /** Content language for localized fields (backend `?locale=`); English when omitted. */
  locale?: "en" | "ar";
}

/**
 * An active bundle offer as described by `GET /bundles/active`. It carries
 * no ids or internal names; pricing never depends on it.
 */
export interface BundleOffer {
  bundleSize: number;
  /** Price of one complete group, minor units. */
  fixedTotal: number;
  currency: string;
  scope: string;
  requireDifferentPhoneModels: boolean;
  isRepeatable: boolean;
  allowCouponStacking: boolean;
  /** Guaranteed minimum saving of any complete group; 0 when it cannot be proven. */
  minSavings: number;
  appliesTo: { type: "ALL" } | { type: "SELECTED"; productSlugs: string[] };
  /** Present on at most one offer: the one chosen for the top announcement bar. */
  announcementBanner?: AnnouncementBanner | null;
}

/** Server-resolved copy and destination for the storefront announcement bar. */
export interface AnnouncementBanner {
  enabled: boolean;
  text: string;
  ctaLabel: string;
  target: { type: "CATALOG" | "COLLECTION" | "PRODUCT"; href: string };
}
