import type { NextRequest } from "next/server";
import { getMoodCollections } from "@/lib/data/collections";
import { getProducts } from "@/lib/data/products";
import { getCollectionCover } from "@/config/collection-covers";
import type {
  SearchCollectionHit,
  SearchProductHit,
  SearchResponse,
} from "@/lib/search-types";

const MAX_QUERY_LENGTH = 80;

/**
 * Header search suggestions.
 *
 * - `?q=anime`        → collections whose name/description match + matching cases
 * - `?collection=x`   → the first few cases of one collection (spotlight)
 * - no params         → every collection (with its cover), no cases
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const collectionSlug = params.get("collection")?.trim() || undefined;

  try {
    const [{ collections }, productList] = await Promise.all([
      getMoodCollections(),
      q || collectionSlug
        ? getProducts({
            q: q || undefined,
            collection: collectionSlug,
            page: 1,
            pageSize: q ? 6 : 4,
          })
        : null,
    ]);

    const needle = q.toLowerCase();
    const collectionHits: SearchCollectionHit[] = collections
      .filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          c.slug.includes(needle) ||
          (c.description ?? "").toLowerCase().includes(needle),
      )
      .map((c) => {
        const cover = getCollectionCover(c.slug, c.coverImage);
        return {
          slug: c.slug,
          name: c.name,
          description: c.description ?? null,
          cover: cover
            ? { src: cover.src, position: cover.position ?? "center" }
            : null,
        };
      });

    // Product search matches whole words ("foot" ≠ "football"), so when the
    // query names a collection but no case, show that collection's cases.
    const products =
      q && productList && productList.items.length === 0 && collectionHits[0]
        ? await getProducts({
            collection: collectionHits[0].slug,
            page: 1,
            pageSize: 6,
          })
        : productList;

    const productHits: SearchProductHit[] = (products?.items ?? []).map(
      (p) => ({
        slug: p.slug,
        name: p.name,
        image: p.primaryImage?.url ?? null,
        priceMinor:
          products?.source === "live" && p.effectivePriceFrom !== null
            ? p.effectivePriceFrom
            : null,
        currency: products?.source === "live" ? p.currency : null,
        collection: p.collections[0]?.name ?? null,
      }),
    );

    const body: SearchResponse = {
      collections: collectionHits,
      products: productHits,
    };
    return Response.json(body, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json(
      { collections: [], products: [] } satisfies SearchResponse,
      { status: 502 },
    );
  }
}
