"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient } from "@/lib/admin/admin-client";
import { useAdminCatalog } from "@/lib/admin/catalog-store";
import { PRODUCT_STATUS_LABEL } from "@/lib/admin/product-display";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminCollection, ProductStatus } from "@/lib/admin/types";

type StatusFilter = "ALL" | ProductStatus;

export default function AdminProductsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const catalog = useAdminCatalog();
  const products = catalog.products ?? [];
  const error = catalog.products === null ? catalog.error : null;
  const isLoading = catalog.products === null && !catalog.error;
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [collectionFilter, setCollectionFilter] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token))
      .then(setCollections)
      .catch(() => {});
  }, [accessToken, authorizedFetch]);

  const needle = query.trim().toLowerCase();
  const visible = products.filter(
    (p) =>
      (statusFilter === "ALL" || p.status === statusFilter) &&
      (!collectionFilter ||
        (collectionFilter === "none"
          ? (p.collections ?? []).length === 0
          : p.collections?.some((c) => c.id === collectionFilter))) &&
      (!needle || p.nameEn.toLowerCase().includes(needle) || p.slug.includes(needle)),
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
          Products
        </h1>
        <Link
          href="/admin/products/new"
          className="rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          New product
        </Link>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Tip: open a <Link href="/admin/catalog/collections" className="font-semibold text-accent underline underline-offset-4">collection</Link>{" "}
        to see just its products.
      </p>

      {isLoading && <LoadingRow label="Loading products…" />}
      {error && <p className="mt-6 text-sm text-accent">{error}</p>}

      {!isLoading && !error && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              aria-label="Filter by collection"
              className="rounded-pill border border-border bg-background px-4 py-2 text-sm"
            >
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
              <option value="none">Not in any collection</option>
            </select>
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
              {(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as StatusFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFilter === value ? "bg-ink text-white" : "bg-surface text-ink shadow-card hover:bg-background"
                  }`}
                >
                  {value === "ALL" ? "All" : PRODUCT_STATUS_LABEL[value]}
                </button>
              ))}
            </div>
            <span className="ms-auto text-sm text-muted-foreground">
              {visible.length} of {products.length}
              {!catalog.isComplete && " · loading more…"}
            </span>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {visible.map((product) => (
              <AdminProductCard key={product.id} product={product} href={`/admin/products/${product.id}`} />
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="mt-6 text-center text-muted-foreground">
              {products.length === 0 ? "No products yet." : "No products match these filters."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
