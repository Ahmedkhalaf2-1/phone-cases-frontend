import { DEMO_MODE } from "@/lib/env";
import { apiGet } from "@/lib/api/http";
import type {
  PaginatedResult,
  ProductQueryParams,
  PublicProductDetail,
  PublicProductSummary,
} from "@/lib/api/types";
import { DEMO_PRODUCTS, type DemoProduct } from "@/lib/demo/products.demo";

export interface FeaturedProductsResult {
  source: "demo" | "live";
  products: (PublicProductSummary | DemoProduct)[];
}

/**
 * Products for the "Caught our eye" homepage section.
 *
 * Demo mode returns local fixtures directly (never as a fallback for a
 * failed request). Live mode calls GET /products and lets a failed
 * request throw — callers decide how to surface that, but it must never
 * be swallowed into fake success.
 */
export async function getFeaturedProducts(
  limit = 4,
): Promise<FeaturedProductsResult> {
  if (DEMO_MODE) {
    return { source: "demo", products: DEMO_PRODUCTS.slice(0, limit) };
  }

  const result = await apiGet<PaginatedResult<PublicProductSummary>>(
    "/products",
    { sort: "newest", pageSize: limit, page: 1, availableOnly: true },
  );

  return { source: "live", products: result.items };
}

export interface ProductListResult {
  source: "demo" | "live";
  items: (PublicProductSummary | DemoProduct)[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

const DEMO_PAGE_SIZE = 20;

function filterDemoProducts(params: ProductQueryParams): DemoProduct[] {
  let items = DEMO_PRODUCTS.slice();

  if (params.q) {
    const q = params.q.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }
  if (params.collection) {
    items = items.filter((p) =>
      p.collections.some((c) => c.slug === params.collection),
    );
  }
  if (params.phoneModel) {
    items = items.filter((p) =>
      p.variants.some((v) => v.phoneModel?.slug === params.phoneModel),
    );
  }
  if (params.caseType) {
    items = items.filter((p) =>
      p.variants.some((v) => v.caseType?.slug === params.caseType),
    );
  }
  if (params.priceMin !== undefined) {
    items = items.filter(
      (p) => (p.effectivePriceFrom ?? 0) >= params.priceMin!,
    );
  }
  if (params.priceMax !== undefined) {
    items = items.filter(
      (p) => (p.effectivePriceFrom ?? 0) <= params.priceMax!,
    );
  }
  if (params.availableOnly) {
    items = items.filter((p) => p.isAvailable);
  }

  if (params.sort === "price_asc") {
    items.sort(
      (a, b) => (a.effectivePriceFrom ?? 0) - (b.effectivePriceFrom ?? 0),
    );
  } else if (params.sort === "price_desc") {
    items.sort(
      (a, b) => (b.effectivePriceFrom ?? 0) - (a.effectivePriceFrom ?? 0),
    );
  }
  // "newest" has no reliable demo signal to sort by; fixture order stands.

  return items;
}

/** Product listing for the /phone-cases store page. */
export async function getProducts(
  params: ProductQueryParams,
): Promise<ProductListResult> {
  if (DEMO_MODE) {
    const filtered = filterDemoProducts(params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? DEMO_PAGE_SIZE;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      source: "demo",
      items,
      meta: {
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      },
    };
  }

  const result = await apiGet<PaginatedResult<PublicProductSummary>>(
    "/products",
    { ...params },
  );

  return { source: "live", items: result.items, meta: result.meta };
}

export interface ProductDetailResult {
  source: "demo" | "live";
  product: PublicProductDetail | DemoProduct;
}

/** Single product for the /products/:slug detail page. Returns null on a 404. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailResult | null> {
  if (DEMO_MODE) {
    const product = DEMO_PRODUCTS.find((p) => p.slug === slug);
    return product ? { source: "demo", product } : null;
  }

  try {
    const product = await apiGet<PublicProductDetail>(`/products/${slug}`);
    return { source: "live", product };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return null;
    }
    throw error;
  }
}
