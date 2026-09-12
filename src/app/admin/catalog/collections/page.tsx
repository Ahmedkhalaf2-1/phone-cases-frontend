"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminCollection } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminCollectionsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");

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
      await authorizedFetch((token) =>
        adminClient.createCollectionAdmin(token, {
          slug,
          nameEn,
          nameAr,
          descriptionEn: descriptionEn || undefined,
        }),
      );
      setSlug("");
      setNameEn("");
      setNameAr("");
      setDescriptionEn("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create collection.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleActive(collection: AdminCollection) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) =>
        adminClient.updateCollectionAdmin(token, collection.id, { isActive: !collection.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update collection.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Collections
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Attach a product to one of these from its product page. These are the
        backend&apos;s actual collections — separate from the storefront&apos;s
        hand-authored &quot;Pick your mood&quot; homepage tiles.
      </p>

      {isLoading && <LoadingRow label="Loading collections…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 flex flex-col gap-3">
          {collections.map((collection) => (
            <div key={collection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-4">
              <div>
                <p className="font-semibold text-ink">{collection.nameEn}</p>
                <p className="text-sm text-muted-foreground">/{collection.slug}</p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleToggleActive(collection)}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 ${
                  collection.isActive ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground"
                }`}
              >
                {collection.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
          {collections.length === 0 && <p className="text-muted-foreground">No collections yet.</p>}
        </div>
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
        <button type="submit" disabled={isBusy} className={`${buttonClass} self-start`}>
          Create
        </button>
      </form>
    </div>
  );
}
