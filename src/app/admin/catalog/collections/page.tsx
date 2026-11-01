"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { useAdminCatalog } from "@/lib/admin/catalog-store";
import { collectionCoverUrl, primaryImageUrl } from "@/lib/admin/product-display";
import type { AdminCollection } from "@/lib/admin/types";

const buttonClass =
  "rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";


export default function AdminCollectionsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const catalog = useAdminCatalog();
  const products = catalog.isComplete ? catalog.products : null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token))
      .then((result) => {
        setCollections(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load collections."))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  function productsIn(collection: AdminCollection) {
    return (catalog.products ?? []).filter((p) => p.collections?.some((c) => c.id === collection.id));
  }

  const q = search.trim().toLowerCase();
  const shown = q
    ? collections.filter((c) => c.nameEn.toLowerCase().includes(q) || c.nameAr.includes(search.trim()))
    : collections;
  const hiddenCount = collections.filter((c) => !c.isActive).length;

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Collections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "\u00a0"
              : `${collections.length} collections${hiddenCount ? ` · ${hiddenCount} hidden from the shop` : ""}`}
          </p>
        </div>
        <Link href="/admin/catalog/collections/new" className={buttonClass}>
          + New collection
        </Link>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {collections.length > 6 && (
        <div className="relative mt-5 max-w-sm">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections"
            aria-label="Search collections"
            className={`w-full rounded-pill border border-border bg-background py-2 ps-10 pe-4 text-sm ${focusRing}`}
          />
        </div>
      )}

      {isLoading ? (
        <ul aria-hidden className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="aspect-[16/10] animate-pulse rounded-card bg-surface" />
          ))}
        </ul>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((collection) => {
            const cover = collectionCoverUrl(collection);
            const inCollection = productsIn(collection);
            return (
              <li key={collection.id}>
                <Link
                  href={`/admin/catalog/collections/${collection.id}`}
                  className={`group relative block aspect-[16/10] overflow-hidden rounded-card bg-surface shadow-card transition-transform duration-300 ease-out hover:-translate-y-0.5 ${focusRing}`}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover.url}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105 ${
                        collection.isActive ? "" : "grayscale"
                      }`}
                    />
                  ) : (
                    <div className="grid h-full grid-cols-3 gap-0.5">
                      {[0, 1, 2].map((index) => {
                        const image = inCollection[index] ? primaryImageUrl(inCollection[index]) : null;
                        return (
                          <div key={index} className="overflow-hidden bg-background">
                            {image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
                  />
                  <div className="absolute start-3 top-3 flex gap-1.5">
                    {!collection.isActive && (
                      <span className="rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-semibold text-ink">
                        Hidden
                      </span>
                    )}
                    {!cover && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        No cover yet
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-white">{collection.nameEn}</p>
                      <p className="text-sm text-white/80">
                        {products === null
                          ? "…"
                          : `${inCollection.length} product${inCollection.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-colors group-hover:bg-accent group-hover:text-white rtl:-scale-x-100">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!isLoading && shown.length === 0 && (
        <div className="mt-5 rounded-card bg-surface px-6 py-16 text-center shadow-card">
          <p className="text-sm font-semibold text-ink">{search ? "No collections match your search" : "No collections yet"}</p>
          {!search && (
            <Link href="/admin/catalog/collections/new" className={`${buttonClass} mt-4 inline-block`}>
              + New collection
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
