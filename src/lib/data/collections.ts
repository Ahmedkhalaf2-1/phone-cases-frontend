import { DEMO_MODE } from "@/lib/env";
import { apiGet } from "@/lib/api/http";
import type { Collection } from "@/lib/api/types";
import {
  DEMO_MOOD_COLLECTIONS,
  type MoodCollection,
} from "@/lib/demo/collections.demo";

export interface MoodCollectionsResult {
  source: "demo" | "live";
  collections: MoodCollection[];
}

const ARTWORK_ROTATION: MoodCollection["artwork"][] = [
  "different",
  "calm",
  "bold",
];

/**
 * Collections for the "Pick your mood" homepage section.
 *
 * The live `GET /collections` endpoint does not return imagery, so live
 * results are mapped onto placeholder artwork keys. Real collection
 * imagery is a documented gap for the next milestone (see
 * docs/FRONTEND_PROGRESS.md), not something this layer invents.
 */
export async function getMoodCollections(): Promise<MoodCollectionsResult> {
  if (DEMO_MODE) {
    return { source: "demo", collections: DEMO_MOOD_COLLECTIONS };
  }

  const collections = await apiGet<Collection[]>("/collections");

  return {
    source: "live",
    collections: collections.map((collection, index) => ({
      ...collection,
      tagline: collection.description ?? "",
      artwork: ARTWORK_ROTATION[index % ARTWORK_ROTATION.length],
    })),
  };
}
