import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getProducts } from "@/lib/data/products";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/phone-cases`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/track`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const { items } = await getProducts({ pageSize: 100, availableOnly: true });
    const productRoutes: MetadataRoute.Sitemap = items.map((product) => ({
      url: `${SITE_URL}/products/${product.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticRoutes, ...productRoutes];
  } catch {
    // Backend unreachable at build/request time — still return the static
    // routes rather than failing the whole sitemap.
    return staticRoutes;
  }
}
