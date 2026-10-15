import type { NextRequest } from "next/server";
import { getProducts } from "@/lib/data/products";
import { parseCatalogParams } from "@/lib/catalog-params";

/**
 * One page of the product listing, for "load more" / infinite scroll.
 * Takes the same query string as /search (q, collection, phoneModel,
 * caseType, availableOnly, sort) plus `page`.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  try {
    const result = await getProducts({
      ...parseCatalogParams(params),
      collection: params.collection || undefined,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load products" }, { status: 502 });
  }
}
