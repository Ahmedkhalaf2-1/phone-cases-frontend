import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
