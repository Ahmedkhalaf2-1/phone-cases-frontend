"use client";

import { use, useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { apiGet } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { AdminProduct, ProductStatus } from "@/lib/admin/types";
import type { CaseType, PhoneModel } from "@/lib/api/types";

const STATUS_VALUES: ProductStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export default function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken } = useAdminAuth();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const formId = useId();

  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [phoneModelId, setPhoneModelId] = useState("");
  const [caseTypeId, setCaseTypeId] = useState("");
  const [isUnlimitedStock, setIsUnlimitedStock] = useState(false);

  const [phoneModels, setPhoneModels] = useState<PhoneModel[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaAlt, setMediaAlt] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editNameEn, setEditNameEn] = useState("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editDescriptionEn, setEditDescriptionEn] = useState("");
  const [editBasePrice, setEditBasePrice] = useState<number | null>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  useEffect(() => {
    // Always the real backend's public catalog, regardless of storefront
    // demo mode — this is staff creating real variants against real data.
    apiGet<PhoneModel[]>("/phone-models").then(setPhoneModels).catch(() => {});
    apiGet<CaseType[]>("/case-types").then(setCaseTypes).catch(() => {});
  }, []);

  function load() {
    if (!accessToken) return;
    adminClient
      .getProduct(accessToken, id)
      .then(setProduct)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load product."),
      );
  }

  useEffect(load, [accessToken, id]);

  async function handleAddVariant(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    if (price === null) {
      setError("Enter the variant's price.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await adminClient.createVariant(accessToken, id, {
        sku,
        price,
        phoneModelId: phoneModelId || undefined,
        caseTypeId: caseTypeId || undefined,
        isUnlimitedStock,
      });
      setSku("");
      setPrice(null);
      setPhoneModelId("");
      setCaseTypeId("");
      setIsUnlimitedStock(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add variant.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleVariantActive(variantId: string, isActive: boolean) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await adminClient.updateVariant(accessToken, id, variantId, { isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update variant.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUploadMedia(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !mediaFile) return;
    setIsUploadingMedia(true);
    setError(null);
    try {
      const asset = await adminClient.uploadMedia(accessToken, mediaFile, mediaAlt);
      await adminClient.attachMediaToProduct(accessToken, id, {
        mediaAssetId: asset.id,
        isPrimary: product?.media.length === 0,
      });
      setMediaFile(null);
      setMediaAlt("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload media.");
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function handleDetachMedia(mediaAssetId: string) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await adminClient.detachMediaFromProduct(accessToken, id, mediaAssetId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove media.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStatusChange(status: ProductStatus) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      const updated = await adminClient.updateProductStatus(accessToken, id, status);
      // The status endpoint's response omits variants/media — merge onto
      // existing state instead of replacing it, or the table would crash.
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setIsBusy(false);
    }
  }

  function startEditingDetails() {
    if (!product) return;
    setEditNameEn(product.nameEn);
    setEditNameAr(product.nameAr);
    setEditDescriptionEn(product.descriptionEn ?? "");
    setEditBasePrice(product.basePrice);
    setIsEditingDetails(true);
  }

  async function handleSaveDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsSavingDetails(true);
    setError(null);
    try {
      const updated = await adminClient.updateProduct(accessToken, id, {
        nameEn: editNameEn,
        nameAr: editNameAr,
        descriptionEn: editDescriptionEn || undefined,
        basePrice: editBasePrice ?? undefined,
      });
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setIsEditingDetails(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setIsSavingDetails(false);
    }
  }

  if (error && !product) return <p className="text-sm text-accent">{error}</p>;
  if (!product) return <LoadingRow label="Loading product…" />;

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        {product.nameEn}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">/{product.slug}</p>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      <div className="mt-4">
        <div className="mb-1 flex items-center gap-2">
          <label className="text-sm font-semibold text-ink">Status</label>
          <StatusBadge status={product.status} />
        </div>
        <select
          disabled={isBusy}
          value={product.status}
          onChange={(e) => handleStatusChange(e.target.value as ProductStatus)}
          className="mt-1 block w-full max-w-xs rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {!isEditingDetails ? (
          <button
            type="button"
            onClick={startEditingDetails}
            className="text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Edit name / description / price
          </button>
        ) : (
          <form onSubmit={handleSaveDetails} className="flex max-w-md flex-col gap-3">
            <input
              required
              placeholder="Name (English)"
              value={editNameEn}
              onChange={(e) => setEditNameEn(e.target.value)}
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <input
              required
              dir="rtl"
              placeholder="الاسم (عربي)"
              value={editNameAr}
              onChange={(e) => setEditNameAr(e.target.value)}
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <textarea
              placeholder="Description (English)"
              rows={3}
              value={editDescriptionEn}
              onChange={(e) => setEditDescriptionEn(e.target.value)}
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <MoneyInput
              label="Base price (optional)"
              minorUnits={editBasePrice}
              onChange={setEditBasePrice}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSavingDetails}
                className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {isSavingDetails ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingDetails(false)}
                className="rounded-sm border border-border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <h2 className="mt-8 font-semibold text-ink">Variants</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-start text-muted-foreground">
              <th className="p-2 text-start">SKU</th>
              <th className="p-2 text-start">Price</th>
              <th className="p-2 text-start">Active</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id} className="border-b border-border">
                <td className="p-2">{variant.sku}</td>
                <td className="p-2">{formatPrice(variant.price, variant.currency)}</td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={variant.isActive}
                    disabled={isBusy}
                    onChange={(e) =>
                      handleToggleVariantActive(variant.id, e.target.checked)
                    }
                    className="size-4 accent-accent"
                  />
                </td>
              </tr>
            ))}
            {product.variants.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted-foreground">
                  No variants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 font-semibold text-ink">Add variant</h3>
      <form onSubmit={handleAddVariant} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <input
          required
          placeholder="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <MoneyInput label="Price" minorUnits={price} onChange={setPrice} className="w-36" />
        <select
          value={phoneModelId}
          onChange={(e) => setPhoneModelId(e.target.value)}
          className="w-56 rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">Any phone model</option>
          {phoneModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.brand.name} {model.name}
            </option>
          ))}
        </select>
        <select
          value={caseTypeId}
          onChange={(e) => setCaseTypeId(e.target.value)}
          className="w-56 rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">Any case type</option>
          {caseTypes.map((caseType) => (
            <option key={caseType.id} value={caseType.id}>
              {caseType.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isUnlimitedStock}
            onChange={(e) => setIsUnlimitedStock(e.target.checked)}
            className="size-4 accent-accent"
          />
          Unlimited stock
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Add
        </button>
      </form>
      <p id={`${formId}-hint`} className="mt-2 text-xs text-muted-foreground">
        Stock (beyond &quot;unlimited&quot;) is managed separately on the
        Stock page once a stock item exists.
      </p>

      <h2 className="mt-8 font-semibold text-ink">Media</h2>
      <div className="mt-2 flex flex-wrap gap-3">
        {product.media.map((attachment) => (
          <div
            key={attachment.id}
            className="relative w-28 rounded-sm border border-border p-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.mediaAsset.url}
              alt={attachment.mediaAsset.altTextEn ?? ""}
              className="aspect-square w-full rounded-sm bg-surface object-cover"
            />
            {attachment.isPrimary && (
              <span className="absolute start-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Primary
              </span>
            )}
            <button
              type="button"
              onClick={() => handleDetachMedia(attachment.mediaAssetId)}
              disabled={isBusy}
              className="mt-1 w-full text-xs text-accent underline underline-offset-2"
            >
              Remove
            </button>
          </div>
        ))}
        {product.media.length === 0 && (
          <p className="text-sm text-muted-foreground">No images yet.</p>
        )}
      </div>

      <form
        onSubmit={handleUploadMedia}
        className="mt-4 flex max-w-lg flex-wrap items-center gap-3"
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <input
          placeholder="Alt text (optional)"
          value={mediaAlt}
          onChange={(e) => setMediaAlt(e.target.value)}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={!mediaFile || isUploadingMedia}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isUploadingMedia ? "Uploading…" : "Upload & attach"}
        </button>
      </form>
      <p className="mt-2 max-w-lg text-xs text-muted-foreground">
        The first upload for a product is set as primary automatically.
        Reordering and choosing a different primary image aren&apos;t built
        yet. Note: the backend currently returns upload URLs as
        <code> http://localhost:3010/uploads/... </code> — these will only
        load correctly on the backend&apos;s own machine until it&apos;s
        configured with its real LAN/public URL.
      </p>
    </div>
  );
}
