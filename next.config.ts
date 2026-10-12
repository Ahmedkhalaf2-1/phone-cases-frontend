import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Public videos default to `max-age=0` (revalidate on every view). Cache
  // them for a day and serve stale for a week while revalidating. Not
  // `immutable`: the filenames aren't versioned, so a replaced video must
  // still be picked up.
  async headers() {
    return [
      {
        source: "/:file*.mp4",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  // The old all-products store page was replaced by /collections (browse)
  // and /search (query/filter results). Keep old links and bookmarks alive.
  async redirects() {
    return [
      {
        source: "/phone-cases",
        has: [{ type: "query", key: "collection", value: "(?<collection>.+)" }],
        destination: "/collections/:collection",
        permanent: true,
      },
      {
        source: "/phone-cases",
        has: [{ type: "query", key: "q" }],
        destination: "/search",
        permanent: true,
      },
      {
        source: "/phone-cases",
        has: [{ type: "query", key: "phoneModel" }],
        destination: "/search",
        permanent: true,
      },
      {
        source: "/phone-cases",
        has: [{ type: "query", key: "sort" }],
        destination: "/search",
        permanent: true,
      },
      {
        source: "/phone-cases",
        destination: "/collections",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
