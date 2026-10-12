import type { ProductSort } from "@/lib/api/types";

const SORT_VALUES: ProductSort[] = ["newest", "price_asc", "price_desc"];

export type CatalogSearchParams = Record<string, string | undefined>;

/** Shared query-string → product query mapping for listing pages. */
export function parseCatalogParams(params: CatalogSearchParams) {
  return {
    q: params.q || undefined,
    phoneModel: params.phoneModel || undefined,
    caseType: params.caseType || undefined,
    availableOnly: params.availableOnly === "true" ? true : undefined,
    sort: SORT_VALUES.find((sort) => sort === params.sort),
    page: Number(params.page ?? "1") || 1,
  };
}

/** Builds a page-N link that keeps every other active filter. */
export function pageHrefBuilder(basePath: string, params: CatalogSearchParams) {
  return (nextPage: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
    }
    next.set("page", String(nextPage));
    return `${basePath}?${next.toString()}`;
  };
}
