import type { Collection } from "@/lib/api/types";

/**
 * DEMO FIXTURE — not real collections.
 *
 * Shaped like `Collection` from the verified backend contract, plus
 * demo-only presentation fields (`artwork`, `tagline`) the live API does
 * not currently return. Kept as data (not hardcoded per-component strings)
 * so real collection copy/imagery can replace this file without touching
 * the `CollectionsSection` component.
 */
export interface MoodCollection extends Collection {
  tagline: string;
  artwork: "different" | "calm" | "bold";
}

export const DEMO_MOOD_COLLECTIONS: MoodCollection[] = [
  {
    id: "demo-different",
    slug: "different",
    name: "Different",
    description: "For a style of your own.",
    tagline: "For a style of your own.",
    artwork: "different",
  },
  {
    id: "demo-calm",
    slug: "calm",
    name: "Calm",
    description: "Quiet details. Strong character.",
    tagline: "Quiet details. Strong character.",
    artwork: "calm",
  },
  {
    id: "demo-bold",
    slug: "bold",
    name: "Bold",
    description: "More color. More you.",
    tagline: "More color. More you.",
    artwork: "bold",
  },
];
