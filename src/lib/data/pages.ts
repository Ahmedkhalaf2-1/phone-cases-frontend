import { DEMO_MODE } from "@/lib/env";
import { apiGet, ApiError } from "@/lib/api/http";

export interface StaticPageSummary {
  slug: string;
  title: string;
}

export interface StaticPageDetail {
  slug: string;
  title: string;
  body: string;
  publishedAt: string;
}

/**
 * Static CMS pages (About, Help, Privacy Policy, Terms & Conditions...).
 * There is no meaningful "demo" for editorial content the shop owner
 * hasn't written yet, so this always calls the real backend; when demo
 * mode is on (no reachable backend), it's treated the same as "not
 * published yet" rather than inventing placeholder legal text.
 */
export async function getStaticPage(
  slug: string,
): Promise<StaticPageDetail | null> {
  if (DEMO_MODE) return null;

  try {
    return await apiGet<StaticPageDetail>(`/pages/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** All published pages — used by the sitemap. */
export async function listStaticPages(): Promise<StaticPageSummary[]> {
  if (DEMO_MODE) return [];
  return apiGet<StaticPageSummary[]>("/pages");
}
