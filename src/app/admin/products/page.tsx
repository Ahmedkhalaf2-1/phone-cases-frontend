"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { PRODUCT_STATUS_LABEL } from "@/lib/admin/product-display";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import type { AdminCollection, AdminProduct, ProductStatus } from "@/lib/admin/types";

type StatusFilter = "ALL" | ProductStatus;

const PAGE_SIZE = 24;
const STATUS_TABS: StatusFilter[] = ["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"];
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
  const [statusCounts, setStatusCounts] = useState<Partial<Record<StatusFilter, number>>>({});

  // Counts for the status tabs (one tiny request each).
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all(
      STATUS_TABS.map((status) =>
        authorizedFetch((token) =>
          adminClient.listProducts(token, {
            page: 1,
            pageSize: 1,
            status: status === "ALL" ? undefined : status,
          }),
        ).then((r) => r.meta.totalItems),
      ),
    )
      .then((totals) => !cancelled && setStatusCounts(Object.fromEntries(STATUS_TABS.map((s, i) => [s, totals[i]]))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, authorizedFetch]);

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
  const hasFilters = Boolean(query || collectionFilter || statusFilter !== "ALL");

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusCounts.ALL !== undefined
              ? `${statusCounts.ALL.toLocaleString("en-US")} designs · ${statusCounts.PUBLISHED ?? 0} live in the shop`
              : "\u00a0"}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className={`rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent ${focusRing}`}
        >
          + New product
        </Link>
      </header>

      {/* Status tabs */}
      <div role="tablist" aria-label="Status" className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {STATUS_TABS.map((value) => {
          const on = statusFilter === value;
          const count = statusCounts[value];
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setStatusFilter(value)}
              className={`flex shrink-0 items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-border/60"
              }`}
            >
              {value === "ALL" ? "All" : PRODUCT_STATUS_LABEL[value]}
              {count !== undefined && (
                <span className={`text-xs tabular-nums ${on ? "text-white/75" : "text-muted-foreground"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + collection */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground"
          >
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name"
            aria-label="Search products"
            className={`w-full rounded-pill border border-border bg-background py-2 ps-10 pe-4 text-sm ${focusRing}`}
          />
        </div>
        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          aria-label="Filter by collection"
          className={`rounded-pill border bg-background px-4 py-2 text-sm ${focusRing} ${
            collectionFilter ? "border-ink font-semibold text-ink" : "border-border"
          }`}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameEn}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCollectionFilter("");
              setStatusFilter("ALL");
            }}
            className="px-2 text-sm font-semibold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ms-auto text-sm text-muted-foreground tabular-nums">
          {isLoading ? "Loading…" : `${visible.length} of ${total}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading && visible.length === 0 ? (
        <ul aria-hidden className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="rounded-card bg-surface p-2 shadow-card">
              <div className="aspect-square animate-pulse rounded-card-inner bg-background" />
              <div className="mx-2 mt-3 h-4 w-3/4 animate-pulse rounded bg-background" />
              <div className="mx-2 mt-2 mb-2 h-3 w-1/3 animate-pulse rounded bg-background" />
            </li>
          ))}
        </ul>
      ) : !isLoading && visible.length === 0 ? (
        <div className="mt-4 rounded-card bg-surface px-6 py-16 text-center shadow-card">
          <p className="text-sm font-semibold text-ink">No products found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters ? "Try a different search or clear the filters." : "Add your first design to get started."}
          </p>
        </div>
      ) : (
        <ul
          className={`mt-4 grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 ${
            isLoading ? "opacity-60" : ""
          }`}
        >
          {visible.map((product) => (
            <AdminProductCard key={product.id} product={product} href={`/admin/products/${product.id}`} />
          ))}
        </ul>
      )}

      {!isLoading && page < totalPages && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
            className={`rounded-pill border border-border bg-background px-5 py-2.5 text-sm font-semibold text-ink transition-colors enabled:hover:border-ink disabled:opacity-60 ${focusRing}`}
          >
            {isLoadingMore ? "Loading…" : `Load ${Math.min(PAGE_SIZE, total - visible.length)} more`}
          </button>
          <span className="text-xs text-muted-foreground">
            Showing {visible.length} of {total}
          </span>
        </div>
      )}
    </div>
  );
}
