"use client";

import { use, useEffect, useId, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { Switch } from "@/components/admin/form-kit";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { AdminPhoneBrand, AdminPhoneModel, CreatePhoneModelInput } from "@/lib/admin/types";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const inputClass = `rounded-pill border border-border bg-background px-4 py-2 text-sm text-ink ${focusRing}`;
const buttonClass = `rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 ${focusRing}`;
const secondaryButtonClass = `rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink ${focusRing}`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminPhoneModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  // ?brand=apple preselects a brand tab (links from the Brands page).
  const { brand: initialBrand } = use(searchParams);
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [models, setModels] = useState<AdminPhoneModel[]>([]);
  const [brands, setBrands] = useState<AdminPhoneBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [brandFilter, setBrandFilter] = useState(initialBrand ?? "");
  const [search, setSearch] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const formId = useId();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ nameEn: "", nameAr: "", releaseYear: "" });

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
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load models."))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const selectedBrand = brands.find((b) => b.slug === brandFilter) ?? null;
  // The create form defaults to the brand being viewed, else the first one.
  const formBrandId = brandId || selectedBrand?.id || brands[0]?.id || "";
  const formBrand = brandById.get(formBrandId);

  function slugFor(name: string, brand = formBrand) {
    return slugify(`${brand?.slug ?? ""} ${name}`);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !formBrandId) return;
    setIsCreating(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createPhoneModel(token, {
          brandId: formBrandId,
          slug,
          nameEn,
          nameAr,
          releaseYear: releaseYear ? Number(releaseYear) : undefined,
        }),
      );
      // Keep the form open on the same brand: models are usually added in a row.
      setSlug("");
      setSlugEdited(false);
      setNameEn("");
      setNameAr("");
      setReleaseYear("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create model.");
    } finally {
      setIsCreating(false);
    }
  }

  async function update(model: AdminPhoneModel, changes: Partial<CreatePhoneModelInput>) {
    setBusyId(model.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) => adminClient.updatePhoneModel(token, model.id, changes));
      setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, ...updated, brand: m.brand } : m)));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update model.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = models.filter(
    (m) =>
      (!selectedBrand || m.brandId === selectedBrand.id) &&
      (!q || m.nameEn.toLowerCase().includes(q) || m.nameAr.includes(search.trim()) || String(m.releaseYear ?? "").includes(q)),
  );
  // Grouped by brand (brand order), newest models first within a brand.
  const groups = brands
    .map((brand) => ({
      brand,
      models: filtered
        .filter((m) => m.brandId === brand.id)
        .sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || a.displayOrder - b.displayOrder),
    }))
    .filter((g) => g.models.length > 0);

  const activeCount = models.filter((m) => m.isActive).length;

  return (
    <div className="max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Phone models</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? " " : `${activeCount} of ${models.length} models shown in the shop`}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isFormOpen}
          aria-controls={formId}
          disabled={brands.length === 0 && !isLoading}
          onClick={() => setIsFormOpen((open) => !open)}
          className={isFormOpen ? secondaryButtonClass : buttonClass}
        >
          {isFormOpen ? "Close" : "+ New model"}
        </button>
      </header>

      {isFormOpen && (
        <form
          id={formId}
          onSubmit={handleCreate}
          className="mt-5 grid gap-3 rounded-card bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[10rem_1fr_1fr_7rem_auto] lg:items-end sm:p-5"
        >
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Brand
            <select
              value={formBrandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                if (!slugEdited) setSlug(slugFor(nameEn, brandById.get(e.target.value)));
              }}
              className={`${inputClass} font-normal`}
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Name (English)
            <input
              required
              autoFocus
              placeholder="e.g. iPhone 17 Pro"
              value={nameEn}
              onChange={(e) => {
                setNameEn(e.target.value);
                if (!slugEdited) setSlug(slugFor(e.target.value));
              }}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            الاسم (عربي)
            <input
              required
              dir="rtl"
              placeholder="مثال: آيفون 17 برو"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Year
            <input
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              placeholder={String(new Date().getFullYear())}
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
              className={`${inputClass} font-normal`}
            />
          </label>
          <button type="submit" disabled={isCreating || !formBrandId} className={buttonClass}>
            {isCreating ? "Adding…" : "Add model"}
          </button>
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground sm:col-span-2 lg:col-span-5">
            Web address
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Lowercase letters, numbers and dashes"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              className={`${inputClass} w-60 py-1.5 font-normal`}
            />
            <span className="font-normal">The form stays open so you can add several in a row.</span>
          </label>
        </form>
      )}

      {/* Brand tabs */}
      {brands.length > 0 && (
        <div role="tablist" aria-label="Brand" className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ slug: "", nameEn: "All", id: "" }, ...brands].map((brand) => {
            const on = brandFilter === brand.slug;
            const count = brand.id ? models.filter((m) => m.brandId === brand.id).length : models.length;
            return (
              <button
                key={brand.slug || "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setBrandFilter(brand.slug)}
                className={`flex shrink-0 items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                  on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-border/60"
                }`}
              >
                {brand.nameEn}
                <span className={`text-xs tabular-nums ${on ? "text-white/75" : "text-muted-foreground"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative mt-3 max-w-sm">
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
          placeholder="Search models or year"
          aria-label="Search phone models"
          className={`w-full rounded-pill border border-border bg-background py-2 ps-10 pe-4 text-sm ${focusRing}`}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading ? (
        <div aria-hidden className="mt-5 h-72 animate-pulse rounded-card bg-surface" />
      ) : brands.length === 0 ? (
        <div className="mt-5 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">Add a phone brand first</p>
          <p className="mt-1 text-sm text-muted-foreground">Models belong to a brand such as Apple or Samsung.</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-5 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">No models found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? "Try a different search." : "Add the first model for this brand."}
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {groups.map(({ brand, models: list }) => (
            <section key={brand.id} className="rounded-card bg-surface shadow-card">
              <h2 className="flex items-center gap-2.5 border-b border-border px-5 py-3 text-sm font-semibold text-ink">
                <BrandLogo
                  slug={brand.slug}
                  name={brand.nameEn}
                  logoUrl={brand.logoMediaAsset?.url}
                  className="size-8 rounded-xl"
                  imageClassName="p-1.5"
                />
                {brand.nameEn}
                <span className="font-normal text-muted-foreground">· {list.length}</span>
                {!brand.isActive && (
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                    Brand hidden
                  </span>
                )}
              </h2>
              <ul className="divide-y divide-border">
                {list.map((model) => {
                  const busy = busyId === model.id;
                  const isEditing = editingId === model.id;
                  return (
                    <li key={model.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <span
                        aria-hidden
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          model.isActive ? "bg-background text-ink" : "bg-background text-muted-foreground/50"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-[18px]">
                          <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2" />
                        </svg>
                      </span>
                      {isEditing ? (
                        <form
                          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const ok = await update(model, {
                              nameEn: edit.nameEn.trim(),
                              nameAr: edit.nameAr.trim(),
                              ...(edit.releaseYear ? { releaseYear: Number(edit.releaseYear) } : {}),
                            });
                            if (ok) setEditingId(null);
                          }}
                        >
                          <input
                            required
                            aria-label="Name (English)"
                            value={edit.nameEn}
                            onChange={(e) => setEdit((s) => ({ ...s, nameEn: e.target.value }))}
                            className={`${inputClass} min-w-0 flex-1 py-1.5`}
                          />
                          <input
                            required
                            dir="rtl"
                            aria-label="الاسم (عربي)"
                            value={edit.nameAr}
                            onChange={(e) => setEdit((s) => ({ ...s, nameAr: e.target.value }))}
                            className={`${inputClass} min-w-0 flex-1 py-1.5`}
                          />
                          <input
                            type="number"
                            aria-label="Release year"
                            placeholder="Year"
                            value={edit.releaseYear}
                            onChange={(e) => setEdit((s) => ({ ...s, releaseYear: e.target.value }))}
                            className={`${inputClass} w-24 py-1.5`}
                          />
                          <button type="submit" disabled={busy} className={`${buttonClass} py-1.5`}>
                            {busy ? "Saving…" : "Save"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className={`${secondaryButtonClass} py-1.5`}>
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className={`min-w-0 flex-1 ${model.isActive ? "" : "opacity-60"}`}>
                            <p className="truncate font-semibold text-ink">{model.nameEn}</p>
                            <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                              <span dir="rtl">{model.nameAr}</span>
                              {model.releaseYear && <span>· {model.releaseYear}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={model.isActive}
                              disabled={busy}
                              onChange={() => update(model, { isActive: !model.isActive })}
                              label={`${model.nameEn} shown in the shop`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(model.id);
                                setEdit({
                                  nameEn: model.nameEn,
                                  nameAr: model.nameAr,
                                  releaseYear: model.releaseYear ? String(model.releaseYear) : "",
                                });
                              }}
                              aria-label={`Edit ${model.nameEn}`}
                              title="Edit"
                              className={`rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-ink ${focusRing}`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
                                <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
