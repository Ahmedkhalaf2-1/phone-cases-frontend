"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { Switch } from "@/components/admin/form-kit";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { builtInBrandLogo } from "@/config/brand-logos";
import type { AdminPhoneBrand, AdminPhoneModel, CreatePhoneBrandInput } from "@/lib/admin/types";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const inputClass = `rounded-pill border border-border bg-background px-4 py-2 text-sm text-ink ${focusRing}`;
const buttonClass = `rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 ${focusRing}`;
const LOGO_TYPES = "image/png,image/jpeg,image/webp,image/gif";
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

function logoProblem(file: File): string | null {
  if (!LOGO_TYPES.split(",").includes(file.type)) return "Use a PNG, JPG, WebP or GIF image.";
  if (file.size > LOGO_MAX_BYTES) return "The logo must be smaller than 5 MB.";
  return null;
}

const secondaryButtonClass = `rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink ${focusRing}`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminPhoneBrandsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [brands, setBrands] = useState<AdminPhoneBrand[]>([]);
  const [models, setModels] = useState<AdminPhoneModel[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const formId = useId();

  function chooseNewLogo(file: File | null) {
    if (file) {
      const problem = logoProblem(file);
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
    setNewLogo(file);
    setNewLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editAr, setEditAr] = useState("");

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listPhoneBrands(token))
      .then((result) => {
        setBrands(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load brands."))
      .finally(() => setIsLoading(false));
    authorizedFetch((token) => adminClient.listPhoneModels(token))
      .then(setModels)
      .catch(() => {});
  }

  useEffect(load, [accessToken, authorizedFetch]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await authorizedFetch((token) => adminClient.createPhoneBrand(token, { slug, nameEn, nameAr }));
      if (newLogo) {
        try {
          const asset = await authorizedFetch((token) => adminClient.uploadMedia(token, newLogo, `${nameEn} logo`));
          await authorizedFetch((token) =>
            adminClient.updatePhoneBrand(token, created.id, { logoMediaAssetId: asset.id }),
          );
        } catch {
          setError("The brand was created, but its logo didn't upload. Try again from the brand's card.");
        }
      }
      chooseNewLogo(null);
      setSlug("");
      setSlugEdited(false);
      setNameEn("");
      setNameAr("");
      setIsFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create brand.");
    } finally {
      setIsCreating(false);
    }
  }

  async function update(brand: AdminPhoneBrand, changes: Partial<CreatePhoneBrandInput>) {
    setBusyId(brand.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) => adminClient.updatePhoneBrand(token, brand.id, changes));
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, ...updated } : b)));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update brand.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function uploadLogo(brand: AdminPhoneBrand, file: File) {
    const problem = logoProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setBusyId(brand.id);
    setError(null);
    try {
      const asset = await authorizedFetch((token) => adminClient.uploadMedia(token, file, `${brand.nameEn} logo`));
      const updated = await authorizedFetch((token) =>
        adminClient.updatePhoneBrand(token, brand.id, { logoMediaAssetId: asset.id }),
      );
      setBrands((prev) =>
        prev.map((b) => (b.id === brand.id ? { ...b, ...updated, logoMediaAsset: updated.logoMediaAsset ?? asset } : b)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload the logo.");
    } finally {
      setBusyId(null);
    }
  }

  const countFor = (brandId: string) => (models ?? []).filter((m) => m.brandId === brandId).length;
  const activeCount = brands.filter((b) => b.isActive).length;

  return (
    <div className="max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Phone brands</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? " " : `${activeCount} of ${brands.length} brands shown in the shop`}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isFormOpen}
          aria-controls={formId}
          onClick={() => setIsFormOpen((open) => !open)}
          className={isFormOpen ? secondaryButtonClass : buttonClass}
        >
          {isFormOpen ? "Cancel" : "+ New brand"}
        </button>
      </header>

      {isFormOpen && (
        <form
          id={formId}
          onSubmit={handleCreate}
          className="mt-5 grid gap-3 rounded-card bg-surface p-4 shadow-card sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end sm:p-5"
        >
          <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Logo
            <label
              className={`group relative cursor-pointer rounded-2xl focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent`}
              title="Choose a logo (PNG with a transparent background works best)"
            >
              <BrandLogo slug={slug} name={nameEn || "?"} logoUrl={newLogoPreview} className="size-[42px]" imageClassName="p-1.5" />
              <span className="absolute -end-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-ink text-xs text-white">
                +
              </span>
              <input
                type="file"
                accept={LOGO_TYPES}
                className="sr-only"
                onChange={(e) => {
                  chooseNewLogo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Name (English)
            <input
              required
              autoFocus
              placeholder="e.g. Samsung"
              value={nameEn}
              onChange={(e) => {
                setNameEn(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            الاسم (عربي)
            <input
              required
              dir="rtl"
              placeholder="مثال: سامسونج"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className={`${inputClass} font-normal`}
            />
          </label>
          <button type="submit" disabled={isCreating} className={buttonClass}>
            {isCreating ? "Creating…" : "Create brand"}
          </button>
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground sm:col-span-4">
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
              className={`${inputClass} w-48 py-1.5 font-normal`}
            />
            <span className="font-normal">
              {newLogo
                ? `Logo: ${newLogo.name}`
                : builtInBrandLogo(slug)
                  ? "This brand already has a built-in logo; uploading one replaces it."
                  : "Optional logo: PNG with a transparent background works best."}
            </span>
          </label>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading ? (
        <ul aria-hidden className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-36 animate-pulse rounded-card bg-surface" />
          ))}
        </ul>
      ) : brands.length === 0 ? (
        <div className="mt-6 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">No brands yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add a brand like Apple or Samsung, then its phone models.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => {
            const count = countFor(brand.id);
            const busy = busyId === brand.id;
            const isEditing = editingId === brand.id;
            return (
              <li
                key={brand.id}
                className={`flex flex-col rounded-card bg-surface p-4 shadow-card ${brand.isActive ? "" : "opacity-70"}`}
              >
                <div className="flex items-start gap-3">
                  <label
                    className={`group relative shrink-0 cursor-pointer rounded-2xl focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                      busy ? "pointer-events-none opacity-60" : ""
                    }`}
                    title={brand.logoMediaAsset ? "Change logo" : "Upload a logo"}
                  >
                    <BrandLogo
                      slug={brand.slug}
                      name={brand.nameEn}
                      logoUrl={brand.logoMediaAsset?.url}
                      className="size-14"
                      muted={!brand.isActive}
                    />
                    <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/70 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {busy ? "…" : brand.logoMediaAsset ? "Change" : "Upload"}
                    </span>
                    <input
                      type="file"
                      accept={LOGO_TYPES}
                      className="sr-only"
                      aria-label={`Upload a logo for ${brand.nameEn}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) uploadLogo(brand, file);
                      }}
                    />
                  </label>
                  {isEditing ? (
                    <form
                      className="flex min-w-0 flex-1 flex-col gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await update(brand, { nameEn: editEn.trim(), nameAr: editAr.trim() })) setEditingId(null);
                      }}
                    >
                      <input
                        required
                        aria-label="Name (English)"
                        value={editEn}
                        onChange={(e) => setEditEn(e.target.value)}
                        className={`${inputClass} py-1.5`}
                      />
                      <input
                        required
                        dir="rtl"
                        aria-label="الاسم (عربي)"
                        value={editAr}
                        onChange={(e) => setEditAr(e.target.value)}
                        className={`${inputClass} py-1.5`}
                      />
                      <div className="flex gap-2">
                        <button type="submit" disabled={busy} className={`${buttonClass} py-1.5`}>
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className={`${secondaryButtonClass} py-1.5`}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold text-ink">{brand.nameEn}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        <span dir="rtl">{brand.nameAr}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {brand.logoMediaAsset ? (
                          <>
                            Uploaded logo ·{" "}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => update(brand, { logoMediaAssetId: null }).then((ok) => ok && setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, logoMediaAsset: null } : b))))}
                              className="font-semibold text-muted-foreground underline underline-offset-2 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </>
                        ) : builtInBrandLogo(brand.slug) ? (
                          "Built-in logo · click it to upload your own"
                        ) : (
                          <span className="text-amber-700">No logo · click the letter to upload one</span>
                        )}
                      </p>
                    </div>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(brand.id);
                        setEditEn(brand.nameEn);
                        setEditAr(brand.nameAr);
                      }}
                      aria-label={`Rename ${brand.nameEn}`}
                      title="Rename"
                      className={`rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-ink ${focusRing}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
                        <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Switch
                      checked={brand.isActive}
                      disabled={busy}
                      onChange={() => update(brand, { isActive: !brand.isActive })}
                      label={`${brand.nameEn} shown in the shop`}
                    />
                    {brand.isActive ? "In shop" : "Hidden"}
                  </span>
                  <Link
                    href={`/admin/catalog/models?brand=${brand.slug}`}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    {models === null ? "Models" : `${count} model${count === 1 ? "" : "s"}`} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
