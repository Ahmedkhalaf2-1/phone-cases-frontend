"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminPhoneBrand } from "@/lib/admin/types";

const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminPhoneBrandsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [brands, setBrands] = useState<AdminPhoneBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listPhoneBrands(token))
      .then((result) => {
        setBrands(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load brands."))
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
        adminClient.createPhoneBrand(token, { slug, nameEn, nameAr }),
      );
      setSlug("");
      setNameEn("");
      setNameAr("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create brand.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleActive(brand: AdminPhoneBrand) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) =>
        adminClient.updatePhoneBrand(token, brand.id, { isActive: !brand.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update brand.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Phone brands
      </h1>

      {isLoading && <LoadingRow label="Loading brands…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">Name</th>
                <th className="p-2 text-start">Slug</th>
                <th className="p-2 text-start">Active</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-b border-border transition-colors hover:bg-surface">
                  <td className="p-2">{brand.nameEn}</td>
                  <td className="p-2 text-muted-foreground">{brand.slug}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleActive(brand)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 ${
                        brand.isActive ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {brand.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    No brands yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New brand</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-wrap gap-3">
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
        <button type="submit" disabled={isBusy} className={buttonClass}>
          Create
        </button>
      </form>
    </div>
  );
}
