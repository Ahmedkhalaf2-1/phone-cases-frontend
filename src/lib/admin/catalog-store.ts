"use client";

import { useEffect, useSyncExternalStore } from "react";
import { apiGet } from "@/lib/api/http";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import type { AdminProduct, AdminProductCollectionRef, ProductMediaAttachment } from "@/lib/admin/types";
import type { PaginatedResult, PublicProductSummary } from "@/lib/api/types";

/**
 * Session-wide cache of every product (with collections + images) for
 * the image-first admin grids.
 *
 * The backend answers one request at a time and a 100-product page takes
 * ~1.5 s, so loading ~700 products takes a while. This store:
 * - loads once per session and is shared by every admin page, so going
 *   back and forth is instant;
 * - publishes after every page, so grids fill in progressively;
 * - is patched in place after edits (`upsertCatalogProduct`,
 *   `patchCatalogProduct`) instead of reloading everything.
 *
 * `GET /admin/products` list items may omit `collections`/`media`, or
 * return collections as raw join rows. Those gaps are filled from the
 * public `GET /products` list (published products) and, for the few the
 * public list doesn't return (Draft / Hidden), the single-product endpoint.
 */

type AuthorizedFetch = <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;

export interface CatalogState {
  products: AdminProduct[] | null;
  /** True once every product has its collections and images. */
  isComplete: boolean;
  error: string | null;
}

const STALE_AFTER_MS = 5 * 60 * 1000;

let state: CatalogState = { products: null, isComplete: false, error: null };
let loadedAt = 0;
let running: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<CatalogState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// --- shape normalisation -------------------------------------------------

type Loose = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

function normalizeCollections(raw: unknown): AdminProductCollectionRef[] | null {
  if (!Array.isArray(raw)) return null;
  const refs: AdminProductCollectionRef[] = [];
  for (const entry of raw as Loose[]) {
    const nested = entry?.collection as Loose | undefined;
    const source = nested && typeof nested === "object" ? nested : entry;
    const id = str(nested?.id) || str(entry?.collectionId) || str(source?.id);
    if (!id) return null;
    refs.push({
      id,
      slug: str(source.slug),
      nameEn: str(source.nameEn) || str(source.name),
      nameAr: str(source.nameAr),
    });
  }
  return refs;
}

function normalizeMedia(raw: unknown): ProductMediaAttachment[] | null {
  if (!Array.isArray(raw)) return null;
  const media = raw as ProductMediaAttachment[];
  return media.every((m) => typeof m?.mediaAsset?.url === "string") ? media : null;
}

/** Card-only stand-in for a product's main image, from the public list. */
function publicPrimaryMedia(productId: string, summary: PublicProductSummary): ProductMediaAttachment[] {
  if (!summary.primaryImage) return [];
  return [
    {
      id: `public-${productId}`,
      productId,
      mediaAssetId: "",
      displayOrder: 0,
      isPrimary: true,
      mediaAsset: {
        id: "",
        storageKey: "",
        url: summary.primaryImage.url,
        mimeType: "",
        fileSizeBytes: 0,
        width: null,
        height: null,
        altTextEn: summary.primaryImage.altText,
        altTextAr: null,
        createdAt: "",
      },
    },
  ];
}

/**
 * A public list item as an admin product, so a collection page can show
 * published products before the full admin catalog has loaded.
 */
export function adminProductFromPublic(summary: PublicProductSummary): AdminProduct {
  return {
    id: summary.id,
    slug: summary.slug,
    nameEn: summary.name,
    nameAr: "",
    descriptionEn: summary.description,
    descriptionAr: null,
    status: "PUBLISHED",
    basePrice: null,
    currency: summary.currency,
    internalNotes: null,
    publishedAt: null,
    createdAt: "",
    updatedAt: "",
    variants:
      summary.effectivePriceFrom === null
        ? []
        : [
            {
              id: `public-${summary.id}`,
              productId: summary.id,
              sku: "",
              phoneModelId: null,
              caseTypeId: null,
              price: summary.effectivePriceFrom,
              compareAtPrice: null,
              currency: summary.currency,
              isActive: true,
              isUnlimitedStock: false,
              stockItemId: null,
              stockItem: null,
            },
          ],
    media: publicPrimaryMedia(summary.id, summary),
    collections: summary.collections.map((c) => ({ id: c.id, slug: c.slug, nameEn: c.name, nameAr: "" })),
  };
}

// --- loading -------------------------------------------------------------

interface Entry {
  product: AdminProduct;
  complete: boolean;
}

function entryFromAdmin(raw: AdminProduct): Entry {
  const collections = normalizeCollections(raw.collections);
  const media = normalizeMedia(raw.media);
  return {
    product: { ...raw, collections: collections ?? [], media: media ?? [] },
    complete: Boolean(collections && media),
  };
}

async function fetchAdminPage(authorizedFetch: AuthorizedFetch, page: number, pageSize: number) {
  return authorizedFetch((token) => adminClient.listProducts(token, { page, pageSize }));
}

async function load(authorizedFetch: AuthorizedFetch) {
  const entries: Entry[] = [];
  const emit = (isComplete: boolean) =>
    publish({ products: entries.map((e) => e.product), isComplete, error: null });

  // Admin list, page by page (100 per page if the backend allows it).
  let pageSize = 100;
  let first;
  try {
    first = await fetchAdminPage(authorizedFetch, 1, pageSize);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 400) throw err;
    pageSize = 50;
    first = await fetchAdminPage(authorizedFetch, 1, pageSize);
  }
  entries.push(...first.items.map(entryFromAdmin));
  emit(false);
  for (let page = 2; page <= first.meta.totalPages; page++) {
    const next = await fetchAdminPage(authorizedFetch, page, pageSize);
    entries.push(...next.items.map(entryFromAdmin));
    emit(false);
  }

  const byId = new Map(entries.map((e) => [e.product.id, e]));
  const missing = () => entries.filter((e) => !e.complete);

  // Fill gaps for published products from the public list.
  if (missing().length > 0) {
    const fill = (items: PublicProductSummary[]) => {
      for (const summary of items) {
        const entry = byId.get(summary.id);
        if (!entry || entry.complete) continue;
        const raw = entry.product;
        entry.product = {
          ...raw,
          media: raw.media.length ? raw.media : publicPrimaryMedia(raw.id, summary),
          collections: summary.collections.map((c) => ({ id: c.id, slug: c.slug, nameEn: c.name, nameAr: "" })),
        };
        entry.complete = true;
      }
      emit(false);
    };
    const firstPublic = await apiGet<PaginatedResult<PublicProductSummary>>("/products", { page: 1, pageSize: 100 });
    fill(firstPublic.items);
    for (let page = 2; page <= firstPublic.meta.totalPages; page++) {
      const next = await apiGet<PaginatedResult<PublicProductSummary>>("/products", { page, pageSize: 100 });
      fill(next.items);
    }
  }

  // Whatever is still missing (Draft / Hidden) one by one.
  for (const entry of missing()) {
    try {
      const detail = await authorizedFetch((token) => adminClient.getProduct(token, entry.product.id));
      entry.product = entryFromAdmin({ ...entry.product, ...detail }).product;
    } catch {
      // Keep it without collections/images rather than fail the whole load.
    }
    entry.complete = true;
    emit(false);
  }

  loadedAt = Date.now();
  emit(true);
}

function ensureLoaded(authorizedFetch: AuthorizedFetch, force = false) {
  const fresh = Date.now() - loadedAt < STALE_AFTER_MS;
  if (running || (!force && state.isComplete && fresh)) return;
  // Stale data stays on screen while it reloads.
  running = load(authorizedFetch)
    .catch((err) =>
      publish({ error: err instanceof ApiError ? err.message : "Could not load products." }),
    )
    .finally(() => {
      running = null;
    });
}

/** Replace one product with its full detail (e.g. after editing it). */
export function upsertCatalogProduct(product: AdminProduct) {
  if (!state.products) return;
  const entry = entryFromAdmin(product);
  const exists = state.products.some((p) => p.id === product.id);
  publish({
    products: exists
      ? state.products.map((p) => (p.id === product.id ? entry.product : p))
      : [entry.product, ...state.products],
  });
}

export function patchCatalogProduct(id: string, patch: (product: AdminProduct) => AdminProduct) {
  if (!state.products) return;
  publish({ products: state.products.map((p) => (p.id === id ? patch(p) : p)) });
}

const serverSnapshot: CatalogState = { products: null, isComplete: false, error: null };

export function useAdminCatalog(): CatalogState & { reload: () => void } {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const snapshot = useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
  useEffect(() => {
    if (accessToken) ensureLoaded(authorizedFetch);
  }, [accessToken, authorizedFetch]);
  return { ...snapshot, reload: () => ensureLoaded(authorizedFetch, true) };
}
