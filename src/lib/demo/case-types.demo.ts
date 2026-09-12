import type { CaseType } from "@/lib/api/types";

/** DEMO FIXTURE — not real case-type inventory. Shaped like `CaseType`. */
export const DEMO_CASE_TYPES: CaseType[] = [
  {
    id: "demo-silicone",
    slug: "silicone",
    name: "Silicone Case",
    description: "Soft-touch, slim fit.",
  },
  {
    id: "demo-tough",
    slug: "tough",
    name: "Tough Case",
    description: "Reinforced corners, extra drop protection.",
  },
  {
    id: "demo-clear",
    slug: "clear",
    name: "Clear Case",
    description: "Transparent, shows the original color.",
  },
];
