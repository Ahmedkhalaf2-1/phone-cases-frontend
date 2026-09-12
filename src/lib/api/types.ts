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
}
