/** Shapes returned by GET /api/search — shared by the route and the header search. */

export interface SearchCollectionHit {
  slug: string;
  name: string;
  description: string | null;
  cover: { src: string; position: "center" | "top" } | null;
}

export interface SearchProductHit {
  slug: string;
  name: string;
  image: string | null;
  /** Minor units + currency (null when there is no price to show, e.g. demo data); formatted on the client. */
  priceMinor: number | null;
  currency: string | null;
  collection: string | null;
}

export interface SearchResponse {
  collections: SearchCollectionHit[];
  products: SearchProductHit[];
}
