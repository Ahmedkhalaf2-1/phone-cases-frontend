/**
 * Collection cover images, keyed by collection slug.
 *
 * Covers uploaded from the admin (`coverImage` on the backend collection)
 * win; otherwise these static files in `public/collections/` are used.
 * The backend field is requested in docs/FRONTEND_PROGRESS.md — until it
 * ships, only the static files apply. Recommended size: 1600×1000
 * (16:10), WebP, keep the subject centred — the collection page banner is
 * wider (2:1) and trims the top/bottom. Covers with a title baked into the
 * top use `position: "top"` so only the bottom is trimmed.
 * Collections without an entry fall back to a collage of their products.
 */
export interface CollectionCover {
  src: string;
  position?: "center" | "top";
}

const COLLECTION_COVERS: Record<string, CollectionCover> = {
  "air-sneaker-culture": {
    src: "/collections/air-sneaker-culture.webp",
    position: "top",
  },
  anime: { src: "/collections/anime.webp", position: "top" },
  "army-police": { src: "/collections/army-police.webp", position: "top" },
  "best-sellers": { src: "/collections/best-sellers.webp", position: "top" },
  "blue-whispers": { src: "/collections/blue-whispers.webp", position: "top" },
  cars: { src: "/collections/cars.webp", position: "top" },
  couples: { src: "/collections/couples.webp", position: "top" },
  dexter: { src: "/collections/dexter.webp", position: "top" },
  "egyptian-art": { src: "/collections/egyptian-art.webp", position: "top" },
  "el-ostora": { src: "/collections/el-ostora.webp", position: "top" },
  football: { src: "/collections/football.webp", position: "top" },
  gaming: { src: "/collections/gaming.webp", position: "top" },
  "harry-potter": { src: "/collections/harry-potter.webp", position: "top" },
  "marvel-vs-dc": { src: "/collections/marvel-vs-dc.webp", position: "top" },
  "movies-series": { src: "/collections/movies-series.webp", position: "top" },
  "not-for-everyone": {
    src: "/collections/not-for-everyone.webp",
    position: "top",
  },
  "psychedelic-art": {
    src: "/collections/psychedelic-art.webp",
    position: "top",
  },
  redbull: { src: "/collections/redbull.webp", position: "top" },
};

export function getCollectionCover(
  slug: string,
  coverImage?: { url: string } | null,
): CollectionCover | undefined {
  if (coverImage?.url) {
    return { src: coverImage.url, position: COLLECTION_COVERS[slug]?.position ?? "center" };
  }
  return COLLECTION_COVERS[slug];
}
