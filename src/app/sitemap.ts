import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getProducts } from "@/lib/data/products";
import { listStaticPages } from "@/lib/data/pages";

const PAGE_SIZE = 100;
/** Hard ceiling so a runaway catalog can't make the sitemap crawl forever
 * or make this route hang — generous well beyond any real store here. */
const MAX_PAGES = 50;

async function getAllInStockProductSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  for (; page <= MAX_PAGES; page++) {
    const { items, meta } = await getProducts({
      pageSize: PAGE_SIZE,
      page,
      availableOnly: true,
    });
    slugs.push(...items.map((item) => item.slug));
    if (page >= meta.totalPages) break;
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/phone-cases`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/track`, changeFrequency: "monthly", priority: 0.3 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  let pageRoutes: MetadataRoute.Sitemap = [];

  try {
    const slugs = await getAllInStockProductSlugs();
    productRoutes = slugs.map((slug) => ({
      url: `${SITE_URL}/products/${slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    // Backend unreachable at build/request time — still return the static
    // routes rather than failing the whole sitemap.
  }

  try {
    const pages = await listStaticPages();
    pageRoutes = pages.map((page) => ({
      url: `${SITE_URL}/pages/${page.slug}`,
      changeFrequency: "monthly",
      priority: 0.4,
    }));
  } catch {
    // Same — an unreachable backend shouldn't break the whole sitemap.
  }

  return [...staticRoutes, ...productRoutes, ...pageRoutes];
}
