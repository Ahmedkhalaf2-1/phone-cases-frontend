"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminPhoneBrand, AdminPhoneModel } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminPhoneModelsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [models, setModels] = useState<AdminPhoneModel[]>([]);
  const [brands, setBrands] = useState<AdminPhoneBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [brandId, setBrandId] = useState("");
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [releaseYear, setReleaseYear] = useState("");

  function load() {
    if (!accessToken) return;
    Promise.all([
      authorizedFetch((token) => adminClient.listPhoneModels(token)),
      authorizedFetch((token) => adminClient.listPhoneBrands(token)),
    ])
      .then(([m, b]) => {
        setModels(m);
        setBrands(b);
        setError(null);
        if (!brandId && b[0]) setBrandId(b[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load models."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [accessToken, authorizedFetch]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !brandId) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createPhoneModel(token, {
          brandId,
          slug,
          nameEn,
          nameAr,
          releaseYear: releaseYear ? Number(releaseYear) : undefined,
        }),
      );
      setSlug("");
      setNameEn("");
      setNameAr("");
      setReleaseYear("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create model.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleActive(model: AdminPhoneModel) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) =>
        adminClient.updatePhoneModel(token, model.id, { isActive: !model.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update model.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Phone models
      </h1>

      {isLoading && <LoadingRow label="Loading models…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">Model</th>
                <th className="p-2 text-start">Brand</th>
                <th className="p-2 text-start">Year</th>
                <th className="p-2 text-start">Active</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id} className="border-b border-border transition-colors hover:bg-surface">
                  <td className="p-2">{model.nameEn}</td>
                  <td className="p-2 text-muted-foreground">{model.brand?.nameEn}</td>
                  <td className="p-2 text-muted-foreground">{model.releaseYear ?? "—"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleActive(model)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 ${
                        model.isActive ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {model.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No models yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New model</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-2xl flex-wrap gap-3">
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass}>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.nameEn}
            </option>
          ))}
        </select>
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
          type="number"
          placeholder="Release year"
          value={releaseYear}
          onChange={(e) => setReleaseYear(e.target.value)}
          className={`${inputClass} w-32`}
        />
        <button type="submit" disabled={isBusy || brands.length === 0} className={buttonClass}>
          Create
        </button>
      </form>
      {brands.length === 0 && !isLoading && (
        <p className="mt-2 text-xs text-muted-foreground">
          Create a phone brand first.
        </p>
      )}
    </div>
  );
}
