import { DEMO_MODE } from "@/lib/env";
import { apiGet } from "@/lib/api/http";
import type { HomepageSection } from "@/lib/api/types";

/**
 * Staff-authored CMS sections (`/admin/homepage-sections`) rendered on the
 * real homepage. No demo content is invented for these — an empty result
 * in demo mode or when nothing is enabled just means nothing renders,
 * never a fake placeholder banner.
 */
export async function getEnabledHomepageSections(): Promise<HomepageSection[]> {
  if (DEMO_MODE) return [];

  try {
    return await apiGet<HomepageSection[]>("/homepage-sections");
  } catch {
    // A CMS outage shouldn't take the whole homepage down with it.
    return [];
  }
}
