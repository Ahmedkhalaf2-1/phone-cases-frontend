"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { PRODUCT_STATUS_LABEL } from "@/lib/admin/product-display";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminCollection, AdminProduct, ProductStatus } from "@/lib/admin/types";

type StatusFilter = "ALL" | ProductStatus;

const PAGE_SIZE = 24;

export default function AdminProductsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [collectionFilter, setCollectionFilter] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token))
      .then(setCollections)
      .catch(() => {});
  }, [accessToken, authorizedFetch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filterKey = `${statusFilter}|${debouncedQuery}|${collectionFilter}`;
  const isLoading = loadedKey !== filterKey;

  // Fetch one page from the server; page 1 replaces, later pages append.
  const fetchPage = useCallback(
    async (target: number) => {
      const res = await authorizedFetch((token) =>
        adminClient.listProducts(token, {
          page: target,
          pageSize: PAGE_SIZE,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          q: debouncedQuery || undefined,
          collectionId: collectionFilter || undefined,
        }),
      );
      // Cards need images; fill any list item that came back without media.
      const items = await Promise.all(
        res.items.map(async (item) => {
          if (Array.isArray(item.media)) return item;
          try {
            const detail = await authorizedFetch((token) => adminClient.getProduct(token, item.id));
            return { ...item, ...detail };
          } catch {
            return item;
          }
        }),
      );
      return { items, meta: res.meta };
    },
    [authorizedFetch, statusFilter, debouncedQuery, collectionFilter],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchPage(1)
      .then(({ items, meta }) => {
        if (cancelled) return;
        setProducts(items);
        setPage(1);
        setTotal(meta.totalItems);
        setTotalPages(meta.totalPages);
        setError(null);
        setLoadedKey(filterKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load products.");
        setLoadedKey(filterKey);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, fetchPage, filterKey]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const { items, meta } = await fetchPage(page + 1);
      setProducts((prev) => [...prev, ...items]);
      setPage(page + 1);
      setTotalPages(meta.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more products.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const visible = products;

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

      {error && <p className="mt-6 text-sm text-accent">{error}</p>}

      {(
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
              {visible.length} of {total}
            </span>
          </div>

          {isLoading && <LoadingRow label="Loading products…" />}
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {visible.map((product) => (
              <AdminProductCard key={product.id} product={product} href={`/admin/products/${product.id}`} />
            ))}
          </ul>
          {!isLoading && visible.length === 0 && (
            <p className="mt-6 text-center text-muted-foreground">No products match these filters.</p>
          )}
          {!isLoading && page < totalPages && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="rounded-pill bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent disabled:opacity-60"
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
