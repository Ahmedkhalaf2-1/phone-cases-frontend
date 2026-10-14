"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { patchCatalogProduct, upsertCatalogProduct, useAdminCatalog } from "@/lib/admin/catalog-store";
import {
  PRODUCT_STATUS_LABEL,
  collectionCoverUrl,
  primaryImageUrl,
} from "@/lib/admin/product-display";
import { AdminProductCard } from "@/components/admin/AdminProductCard";
import { ImageFileButton, ImageUploadDialog } from "@/components/admin/ImageUpload";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminCollection, AdminProduct, ProductStatus } from "@/lib/admin/types";

const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-pill bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondaryButtonClass =
  "rounded-pill border border-border bg-background px-5 py-2 text-sm font-semibold transition-colors enabled:hover:border-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const COVER_UNSUPPORTED =
  "The image uploaded, but the backend can't store collection covers yet. " +
  "It needs the small change described in docs/FRONTEND_PROGRESS.md " +
  "(\"Backend request: collection covers\"). The current cover is unchanged.";

type StatusFilter = "ALL" | ProductStatus;

export default function AdminCollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken, authorizedFetch } = useAdminAuth();

  const [collection, setCollection] = useState<AdminCollection | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  // The full catalog is only needed for the "Add existing products" picker,
  // so don't let it queue ahead of this collection's own products.
  const catalog = useAdminCatalog(isAdding);
  // This collection's products (every status) via the admin list's
  // collectionId filter — fast, independent of the full catalog, which is
  // only needed for the "Add existing products" picker.
  const [members, setMembers] = useState<AdminProduct[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [addQuery, setAddQuery] = useState("");

  const loadCollection = useCallback(async () => {
    // There's no single-collection admin endpoint; the list is small.
    const all = await authorizedFetch((token) => adminClient.listCollectionsAdmin(token));
    const found = all.find((c) => c.id === id) ?? null;
    setCollection(found);
    setNotFound(!found);
    return found;
  }, [authorizedFetch, id]);

  useEffect(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token))
      .then((all) => {
        const found = all.find((c) => c.id === id) ?? null;
        setCollection(found);
        setNotFound(!found);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load this collection."),
      );
  }, [accessToken, authorizedFetch, id]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      const pageSize = 100;
      const first = await authorizedFetch((token) =>
        adminClient.listProducts(token, { collectionId: id, page: 1, pageSize }),
      );
      const items = [...first.items];
      for (let page = 2; page <= first.meta.totalPages; page++) {
        const next = await authorizedFetch((token) =>
          adminClient.listProducts(token, { collectionId: id, page, pageSize }),
        );
        items.push(...next.items);
      }
      return items;
    })()
      .then((items) => {
        if (cancelled) return;
        setMembers(items);
        items.forEach(upsertCatalogProduct);
      })
      .catch((err) => {
        if (!cancelled) setMembersError(err instanceof ApiError ? err.message : "Could not load products.");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, authorizedFetch, id]);

  const products = catalog.products;
  const inCollection = useMemo(() => members ?? [], [members]);
  const notInCollection = useMemo(() => {
    const memberIds = new Set(inCollection.map((p) => p.id));
    return (products ?? []).filter((p) => !memberIds.has(p.id));
  }, [products, inCollection]);
  const isLoadingProducts = members === null && !membersError;

  const needle = query.trim().toLowerCase();
  const visible = inCollection.filter(
    (p) =>
      (statusFilter === "ALL" || p.status === statusFilter) &&
      (!needle || p.nameEn.toLowerCase().includes(needle) || p.slug.includes(needle)),
  );
  const addNeedle = addQuery.trim().toLowerCase();
  const addCandidates = notInCollection.filter(
    (p) => !addNeedle || p.nameEn.toLowerCase().includes(addNeedle) || p.slug.includes(addNeedle),
  );

  async function saveCover(altText: string) {
    if (!coverFile) return;
    const asset = await authorizedFetch((token) =>
      adminClient.uploadMedia(token, coverFile, altText || undefined),
    );
    try {
      await authorizedFetch((token) =>
        adminClient.updateCollectionAdmin(token, id, { coverMediaAssetId: asset.id }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) throw new Error(COVER_UNSUPPORTED);
      throw err;
    }
    // A backend that silently strips unknown fields would "succeed"
    // without saving anything — check rather than assume.
    const refreshed = await loadCollection();
    if (refreshed?.coverMediaAssetId !== asset.id) throw new Error(COVER_UNSUPPORTED);
    setCoverFile(null);
    setNotice("Cover updated.");
  }

  async function removeUploadedCover() {
    if (!window.confirm("Remove the uploaded cover?")) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateCollectionAdmin(token, id, { coverMediaAssetId: null }),
      );
      await loadCollection();
      setNotice("Uploaded cover removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the cover.");
    } finally {
      setIsBusy(false);
    }
  }

  function startEditingDetails() {
    if (!collection) return;
    setNameEn(collection.nameEn);
    setNameAr(collection.nameAr);
    setDescriptionEn(collection.descriptionEn ?? "");
    setDescriptionAr(collection.descriptionAr ?? "");
    setIsEditingDetails(true);
  }

  async function handleSaveDetails(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateCollectionAdmin(token, id, {
          nameEn,
          nameAr,
          descriptionEn: descriptionEn || undefined,
          descriptionAr: descriptionAr || undefined,
        }),
      );
      await loadCollection();
      setIsEditingDetails(false);
      setNotice("Details saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save details.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!collection) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateCollectionAdmin(token, id, { isActive: !collection.isActive }),
      );
      await loadCollection();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the collection.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddProduct(product: AdminProduct) {
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) => adminClient.attachCollectionToProduct(token, product.id, id));
      setMembers((prev) => (prev ? [product, ...prev] : prev));
      patchCatalogProduct(product.id, (p) => ({
        ...p,
        collections: [
          ...p.collections,
          { id, slug: collection?.slug ?? "", nameEn: collection?.nameEn ?? "", nameAr: collection?.nameAr ?? "" },
        ],
      }));
      setNotice(`Added “${product.nameEn}”.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the product.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemoveProduct(product: AdminProduct) {
    if (!window.confirm(`Remove “${product.nameEn}” from this collection? The product itself is not deleted.`)) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) => adminClient.detachCollectionFromProduct(token, product.id, id));
      patchCatalogProduct(product.id, (p) => ({
        ...p,
        collections: p.collections.filter((c) => c.id !== id),
      }));
      setMembers((prev) => prev?.filter((p) => p.id !== product.id) ?? prev);
      setNotice(`Removed “${product.nameEn}” from this collection.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the product.");
    } finally {
      setIsBusy(false);
    }
  }

  if (notFound) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">This collection doesn&apos;t exist.</p>
        <Link href="/admin/catalog/collections" className="mt-2 inline-block text-sm font-semibold text-accent underline">
          ← All collections
        </Link>
      </div>
    );
  }
  if (!collection) {
    return error ? <p className="text-sm text-accent">{error}</p> : <LoadingRow label="Loading collection…" />;
  }

  const cover = collectionCoverUrl(collection);
  const statusCounts = (status: ProductStatus) => inCollection.filter((p) => p.status === status).length;

  return (
    <div className="max-w-6xl">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/admin/catalog/collections" className="hover:text-accent">
          Collections
        </Link>{" "}
        / <span className="text-ink">{collection.nameEn}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">{collection.nameEn}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the collection cover and its products.</p>
        </div>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={isBusy}
          className={`rounded-pill px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${
            collection.isActive ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground shadow-card"
          }`}
          title={collection.isActive ? "Click to hide from the shop" : "Click to show in the shop"}
        >
          {collection.isActive ? "● Visible in shop" : "○ Hidden from shop"}
        </button>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && !error && (
        <p aria-live="polite" className="mt-4 text-sm font-semibold text-green-700">
          ✓ {notice}
        </p>
      )}

      {/* Cover */}
      <section aria-labelledby="cover-heading" className="mt-6 rounded-card bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="cover-heading" className="text-lg font-semibold text-ink">
              Collection cover
            </h2>
            <p className="text-sm text-muted-foreground">
              {cover?.source === "uploaded"
                ? "Uploaded cover."
                : cover
                  ? "Built-in cover from the website files. Upload one to replace it."
                  : "No cover yet — the shop shows a collage of this collection's products instead."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cover?.source === "uploaded" && (
              <button type="button" onClick={removeUploadedCover} disabled={isBusy} className={secondaryButtonClass}>
                Remove uploaded cover
              </button>
            )}
            <ImageFileButton
              onSelect={(file) => {
                setNotice(null);
                setCoverFile(file);
              }}
              onInvalid={setError}
              disabled={isBusy}
              className={buttonClass}
            >
              {cover ? "Change cover image" : "Add cover image"}
            </ImageFileButton>
          </div>
        </div>

        <div className="mt-4 aspect-[16/10] overflow-hidden rounded-card-inner bg-background">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <div className="grid h-full grid-cols-3 gap-1">
              {[0, 1, 2].map((index) => {
                const image = inCollection[index] ? primaryImageUrl(inCollection[index]) : null;
                return (
                  <div key={index} className="overflow-hidden bg-surface">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Best at 1600 × 1000 (16:10). Keep the subject in the middle — the collection page banner is wider and trims the
          top and bottom.
        </p>
      </section>

      {/* Details */}
      <section aria-labelledby="details-heading" className="mt-6 rounded-card bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="details-heading" className="text-lg font-semibold text-ink">
            Name &amp; description
          </h2>
          {!isEditingDetails && (
            <button type="button" onClick={startEditingDetails} className={secondaryButtonClass}>
              Edit
            </button>
          )}
        </div>
        {!isEditingDetails ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">English</dt>
              <dd className="font-semibold text-ink">{collection.nameEn}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Arabic</dt>
              <dd dir="rtl" className="font-semibold text-ink">
                {collection.nameAr}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Web address</dt>
              <dd className="text-ink">/collections/{collection.slug}</dd>
            </div>
            {collection.descriptionEn && (
              <div className="sm:col-span-3">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="text-ink">{collection.descriptionEn}</dd>
              </div>
            )}
            {collection.descriptionAr && (
              <div className="sm:col-span-3">
                <dt className="text-muted-foreground">Description (Arabic)</dt>
                <dd dir="rtl" className="text-ink">
                  {collection.descriptionAr}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <form onSubmit={handleSaveDetails} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Name (English)
              <input required value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              الاسم (عربي)
              <input required dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
              Description (English, optional)
              <textarea
                rows={2}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className={`${inputClass} rounded-2xl`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
              الوصف (عربي، اختياري)
              <textarea
                dir="rtl"
                rows={2}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                className={`${inputClass} rounded-2xl`}
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={isBusy} className={buttonClass}>
                Save changes
              </button>
              <button type="button" onClick={() => setIsEditingDetails(false)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Products */}
      <section aria-labelledby="products-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="products-heading" className="font-display text-2xl tracking-tight text-ink uppercase">
              Products in this collection
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLoadingProducts
                ? "Loading…"
                : `${inCollection.length} product${inCollection.length === 1 ? "" : "s"}`}

            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsAdding((open) => !open)}
              aria-expanded={isAdding}
              className={secondaryButtonClass}
            >
              {isAdding ? "Done adding" : "+ Add existing products"}
            </button>
            <Link
              href={`/admin/products/new?collection=${collection.id}`}
              className="rounded-pill bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              + New product here
            </Link>
          </div>
        </div>

        {isAdding && (
          <div className="mt-4 rounded-card bg-accent-wash p-4">
            <input
              type="search"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Search products to add…"
              className={`${inputClass} w-full max-w-sm`}
              autoFocus
            />
            <ul className="mt-3 grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
              {addCandidates.map((product) => {
                const image = primaryImageUrl(product);
                return (
                  <li key={product.id} className="flex flex-col rounded-2xl bg-surface p-1.5">
                    <div className="aspect-square overflow-hidden rounded-xl bg-background">
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 px-1 text-xs font-semibold text-ink">{product.nameEn}</p>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAddProduct(product)}
                      className="mt-auto rounded-pill bg-ink px-3 py-1 text-xs font-semibold text-white enabled:hover:bg-accent disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                );
              })}
              {addCandidates.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  {products === null
                    ? "Loading products…"
                    : notInCollection.length === 0
                      ? "Every product is already in this collection."
                      : "No matches."}
                </p>
              )}
            </ul>
          </div>
        )}

        {inCollection.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in this collection…"
              className={`${inputClass} w-full max-w-xs`}
            />
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
              {(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as StatusFilter[]).map((value) => {
                const count = value === "ALL" ? inCollection.length : statusCounts(value);
                if (value !== "ALL" && count === 0) return null;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                    className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
                      statusFilter === value ? "bg-ink text-white" : "bg-surface text-ink shadow-card hover:bg-background"
                    }`}
                  >
                    {value === "ALL" ? "All" : PRODUCT_STATUS_LABEL[value]} · {count}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {membersError && (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
            Couldn&apos;t load products: {membersError}
          </p>
        )}
        {isLoadingProducts ? (
          <LoadingRow label="Loading products…" />
        ) : inCollection.length === 0 ? (
          <p className="mt-6 rounded-card border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No products in this collection yet. Use “Add existing products” or “New product here”.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((product) => (
              <AdminProductCard
                key={product.id}
                product={product}
                href={`/admin/products/${product.id}?collection=${collection.id}`}
                action={
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRemoveProduct(product)}
                    className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-50"
                  >
                    Remove from collection
                  </button>
                }
              />
            ))}
            {visible.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No matches.</p>}
          </ul>
        )}
      </section>

      <ImageUploadDialog
        file={coverFile}
        title={cover ? "Change cover image" : "Add cover image"}
        currentImageUrl={cover?.url ?? null}
        confirmLabel="Save cover"
        aspect="cover"
        onCancel={() => setCoverFile(null)}
        onConfirm={async (altText) => {
          try {
            await saveCover(altText);
          } catch (err) {
            throw new Error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed.");
          }
        }}
      />
    </div>
  );
}
