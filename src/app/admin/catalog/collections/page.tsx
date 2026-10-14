"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { useAdminCatalog } from "@/lib/admin/catalog-store";
import { collectionCoverUrl, primaryImageUrl } from "@/lib/admin/product-display";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminCollection } from "@/lib/admin/types";

const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminCollectionsPage() {
  const router = useRouter();
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const catalog = useAdminCatalog();
  const products = catalog.isComplete ? catalog.products : null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");

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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      const created = await authorizedFetch((token) =>
        adminClient.createCollectionAdmin(token, {
          slug,
          nameEn,
          nameAr,
          descriptionEn: descriptionEn || undefined,
          descriptionAr: descriptionAr || undefined,
        }),
      );
      setSlug("");
      setNameEn("");
      setNameAr("");
      setDescriptionEn("");
      setDescriptionAr("");
      // Straight to the new collection so the cover can be added next.
      router.push(`/admin/catalog/collections/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create collection.");
    } finally {
      setIsBusy(false);
    }
  }

  function productsIn(collection: AdminCollection) {
    return (catalog.products ?? []).filter((p) => p.collections?.some((c) => c.id === collection.id));
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Collections
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Open a collection to change its cover and see every product in it.
      </p>

      {isLoading && <LoadingRow label="Loading collections…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => {
            const cover = collectionCoverUrl(collection);
            const inCollection = productsIn(collection);
            return (
              <li key={collection.id}>
                <Link
                  href={`/admin/catalog/collections/${collection.id}`}
                  className="group flex h-full flex-col rounded-card bg-surface p-2 shadow-card transition-transform duration-300 ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-card-inner bg-background">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover.url}
                        alt=""
                        className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
                      />
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
                        <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-amber-800">
                          No cover yet
                        </span>
                      </div>
                    )}
                    {!collection.isActive && (
                      <span className="absolute start-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-3 px-2 pt-3 pb-1">
                    <div>
                      <p className="font-semibold text-ink">{collection.nameEn}</p>
                      <p className="text-sm text-muted-foreground">
                        {products === null ? "…" : `${inCollection.length} product${inCollection.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-accent group-hover:underline">Open →</span>
                  </div>
                </Link>
              </li>
            );
          })}
          {collections.length === 0 && <p className="text-muted-foreground">No collections yet.</p>}
        </ul>
      )}

      <h2 className="mt-8 font-semibold text-ink">New collection</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-col gap-3">
        <input
          required
          placeholder="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={inputClass}
        />
        <input
          required
          placeholder="Name (English)"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className={inputClass}
        />
        <input
          required
          dir="rtl"
          placeholder="الاسم (عربي)"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Description (English, optional)"
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          className={inputClass}
        />
        <input
          dir="rtl"
          placeholder="الوصف (عربي، اختياري)"
          value={descriptionAr}
          onChange={(e) => setDescriptionAr(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={isBusy} className={`${buttonClass} self-start`}>
          Create
        </button>
      </form>
    </div>
  );
}
