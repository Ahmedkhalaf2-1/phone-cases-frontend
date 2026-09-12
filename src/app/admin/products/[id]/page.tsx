"use client";

import { use, useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { apiGet } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { AdminCollection, AdminProduct, AdminVariant, ProductStatus, StockItem } from "@/lib/admin/types";
import type { CaseType, PhoneModel } from "@/lib/api/types";

const STATUS_VALUES: ProductStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface VariantFormState {
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  phoneModelId: string;
  caseTypeId: string;
  isUnlimitedStock: boolean;
  stockItemId: string;
  isActive: boolean;
}

const EMPTY_VARIANT_FORM: VariantFormState = {
  sku: "",
  price: null,
  compareAtPrice: null,
  phoneModelId: "",
  caseTypeId: "",
  isUnlimitedStock: false,
  stockItemId: "",
  isActive: true,
};

export default function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const formId = useId();

  const [phoneModels, setPhoneModels] = useState<PhoneModel[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [attachCollectionId, setAttachCollectionId] = useState("");

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaAlt, setMediaAlt] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editNameEn, setEditNameEn] = useState("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editDescriptionEn, setEditDescriptionEn] = useState("");
  const [editBasePrice, setEditBasePrice] = useState<number | null>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const [newVariant, setNewVariant] = useState<VariantFormState>(EMPTY_VARIANT_FORM);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariantForm, setEditVariantForm] = useState<VariantFormState>(EMPTY_VARIANT_FORM);

  useEffect(() => {
    // Always the real backend's public catalog, regardless of storefront
    // demo mode — this is staff creating real variants against real data.
    apiGet<PhoneModel[]>("/phone-models").then(setPhoneModels).catch(() => {});
    apiGet<CaseType[]>("/case-types").then(setCaseTypes).catch(() => {});
  }, []);

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.getProduct(token, id))
      .then(setProduct)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load product."),
      );
    authorizedFetch((token) => adminClient.listStockItems(token))
      .then(setStockItems)
      .catch(() => {});
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token))
      .then(setCollections)
      .catch(() => {});
  }

  useEffect(load, [accessToken, authorizedFetch, id]);

  function variantInputFromForm(form: VariantFormState) {
    return {
      sku: form.sku,
      price: form.price ?? 0,
      compareAtPrice: form.compareAtPrice ?? undefined,
      phoneModelId: form.phoneModelId || undefined,
      caseTypeId: form.caseTypeId || undefined,
      isActive: form.isActive,
      isUnlimitedStock: form.isUnlimitedStock,
      // Mutually exclusive with unlimited stock — the backend rejects
      // both being set, so this UI never sends both.
      stockItemId: form.isUnlimitedStock ? undefined : form.stockItemId || undefined,
    };
  }

  async function handleAddVariant(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    if (newVariant.price === null) {
      setError("Enter the variant's price.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createVariant(token, id, variantInputFromForm(newVariant)),
      );
      setNewVariant(EMPTY_VARIANT_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add variant.");
    } finally {
      setIsBusy(false);
    }
  }

  function startEditingVariant(variant: AdminVariant) {
    setEditingVariantId(variant.id);
    setEditVariantForm({
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      phoneModelId: variant.phoneModelId ?? "",
      caseTypeId: variant.caseTypeId ?? "",
      isUnlimitedStock: variant.isUnlimitedStock,
      stockItemId: variant.stockItemId ?? "",
      isActive: variant.isActive,
    });
  }

  async function handleSaveVariant(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !editingVariantId) return;
    if (editVariantForm.price === null) {
      setError("Enter the variant's price.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateVariant(token, id, editingVariantId, variantInputFromForm(editVariantForm)),
      );
      setEditingVariantId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save variant. Duplicate SKU or combination?");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleVariantActive(variantId: string, isActive: boolean) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) => adminClient.updateVariant(token, id, variantId, { isActive }));
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
      const asset = await authorizedFetch((token) => adminClient.uploadMedia(token, mediaFile, mediaAlt));
      await authorizedFetch((token) =>
        adminClient.attachMediaToProduct(token, id, {
          mediaAssetId: asset.id,
          isPrimary: product?.media.length === 0,
        }),
      );
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
      await authorizedFetch((token) => adminClient.detachMediaFromProduct(token, id, mediaAssetId));
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
      const updated = await authorizedFetch((token) => adminClient.updateProductStatus(token, id, status));
      // The status endpoint's response omits variants/media/collections —
      // merge onto existing state instead of replacing it, or the tables
      // below would crash.
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
      const updated = await authorizedFetch((token) =>
        adminClient.updateProduct(token, id, {
          nameEn: editNameEn,
          nameAr: editNameAr,
          descriptionEn: editDescriptionEn || undefined,
          basePrice: editBasePrice ?? undefined,
        }),
      );
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setIsEditingDetails(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function handleAttachCollection(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !attachCollectionId) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.attachCollectionToProduct(token, id, attachCollectionId),
      );
      setAttachCollectionId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not attach collection.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDetachCollection(collectionId: string) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) => adminClient.detachCollectionFromProduct(token, id, collectionId));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove collection.");
    } finally {
      setIsBusy(false);
    }
  }

  if (error && !product) return <p className="text-sm text-accent">{error}</p>;
  if (!product) return <LoadingRow label="Loading product…" />;

  const availableCollectionsToAttach = collections.filter(
    (c) => !product.collections.some((pc) => pc.id === c.id),
  );

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
          className={`mt-1 block w-full max-w-xs ${inputClass}`}
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
              className={inputClass}
            />
            <input
              required
              dir="rtl"
              placeholder="الاسم (عربي)"
              value={editNameAr}
              onChange={(e) => setEditNameAr(e.target.value)}
              className={inputClass}
            />
            <textarea
              placeholder="Description (English)"
              rows={3}
              value={editDescriptionEn}
              onChange={(e) => setEditDescriptionEn(e.target.value)}
              className={inputClass}
            />
            <MoneyInput label="Base price (optional)" minorUnits={editBasePrice} onChange={setEditBasePrice} />
            <div className="flex gap-2">
              <button type="submit" disabled={isSavingDetails} className={buttonClass}>
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

      <h2 className="mt-8 font-semibold text-ink">Collections</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {product.collections.map((collection) => (
          <span
            key={collection.id}
            className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase"
          >
            {collection.nameEn}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleDetachCollection(collection.id)}
              aria-label={`Remove from ${collection.nameEn}`}
              className="text-accent"
            >
              ×
            </button>
          </span>
        ))}
        {product.collections.length === 0 && (
          <p className="text-sm text-muted-foreground">Not in any collection yet.</p>
        )}
      </div>
      {availableCollectionsToAttach.length > 0 && (
        <form onSubmit={handleAttachCollection} className="mt-2 flex gap-2">
          <select
            value={attachCollectionId}
            onChange={(e) => setAttachCollectionId(e.target.value)}
            className={inputClass}
          >
            <option value="">Add to collection…</option>
            {availableCollectionsToAttach.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>
          <button type="submit" disabled={isBusy || !attachCollectionId} className={buttonClass}>
            Add
          </button>
        </form>
      )}

      <h2 className="mt-8 font-semibold text-ink">Variants</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-start text-muted-foreground">
              <th className="p-2 text-start">SKU</th>
              <th className="p-2 text-start">Compatibility</th>
              <th className="p-2 text-start">Price</th>
              <th className="p-2 text-start">Stock</th>
              <th className="p-2 text-start">Active</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => {
              const model = phoneModels.find((m) => m.id === variant.phoneModelId);
              const caseType = caseTypes.find((c) => c.id === variant.caseTypeId);
              const stockItem = stockItems.find((s) => s.id === variant.stockItemId) ?? variant.stockItem;
              return (
                <>
                  <tr key={variant.id} className="border-b border-border">
                    <td className="p-2 font-mono text-xs">{variant.sku}</td>
                    <td className="p-2 text-muted-foreground">
                      {[model?.name, caseType?.name].filter(Boolean).join(" · ") || "Accessory (no phone model)"}
                    </td>
                    <td className="p-2">{formatPrice(variant.price, variant.currency)}</td>
                    <td className="p-2 text-muted-foreground">
                      {variant.isUnlimitedStock
                        ? "Unlimited"
                        : stockItem
                          ? `${stockItem.onHand - stockItem.reserved} available`
                          : "No stock item"}
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        disabled={isBusy}
                        onChange={(e) => handleToggleVariantActive(variant.id, e.target.checked)}
                        className="size-4 accent-accent"
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() =>
                          editingVariantId === variant.id
                            ? setEditingVariantId(null)
                            : startEditingVariant(variant)
                        }
                        className="text-xs font-semibold text-accent underline underline-offset-4"
                      >
                        {editingVariantId === variant.id ? "Cancel" : "Edit"}
                      </button>
                    </td>
                  </tr>
                  {editingVariantId === variant.id && (
                    <tr className="border-b border-border bg-surface">
                      <td colSpan={6} className="p-3">
                        <VariantForm
                          form={editVariantForm}
                          setForm={setEditVariantForm}
                          phoneModels={phoneModels}
                          caseTypes={caseTypes}
                          stockItems={stockItems}
                          onSubmit={handleSaveVariant}
                          submitLabel="Save variant"
                          disabled={isBusy}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {product.variants.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No variants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 font-semibold text-ink">Add variant</h3>
      <div className="mt-2">
        <VariantForm
          form={newVariant}
          setForm={setNewVariant}
          phoneModels={phoneModels}
          caseTypes={caseTypes}
          stockItems={stockItems}
          onSubmit={handleAddVariant}
          submitLabel="Add"
          disabled={isBusy}
        />
      </div>
      <p id={`${formId}-hint`} className="mt-2 text-xs text-muted-foreground">
        Leaving phone model/case type unset means this variant is an
        accessory, not something &quot;compatible with every phone.&quot;
        Stock item and unlimited stock can&apos;t both be set — picking one
        clears the other.
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

      <form onSubmit={handleUploadMedia} className="mt-4 flex max-w-lg flex-wrap items-center gap-3">
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
          className={inputClass}
        />
        <button type="submit" disabled={!mediaFile || isUploadingMedia} className={buttonClass}>
          {isUploadingMedia ? "Uploading…" : "Upload & attach"}
        </button>
      </form>
      <p className="mt-2 max-w-lg text-xs text-muted-foreground">
        The first upload for a product is set as primary automatically.
        Reordering and choosing a different primary image aren&apos;t
        supported by the backend yet — only upload/attach/detach. Note: the
        backend currently returns upload URLs as
        <code> http://localhost:3010/uploads/... </code> — these will only
        load correctly on the backend&apos;s own machine until it&apos;s
        configured with its real LAN/public URL.
      </p>
    </div>
  );
}

function VariantForm({
  form,
  setForm,
  phoneModels,
  caseTypes,
  stockItems,
  onSubmit,
  submitLabel,
  disabled,
}: {
  form: VariantFormState;
  setForm: (updater: (prev: VariantFormState) => VariantFormState) => void;
  phoneModels: PhoneModel[];
  caseTypes: CaseType[];
  stockItems: StockItem[];
  onSubmit: (event: React.FormEvent) => void;
  submitLabel: string;
  disabled: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <input
        required
        placeholder="SKU"
        value={form.sku}
        onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
        className={inputClass}
      />
      <MoneyInput
        label="Price"
        minorUnits={form.price}
        onChange={(v) => setForm((f) => ({ ...f, price: v }))}
        className="w-32"
      />
      <MoneyInput
        label="Compare-at (optional)"
        minorUnits={form.compareAtPrice}
        onChange={(v) => setForm((f) => ({ ...f, compareAtPrice: v }))}
        className="w-32"
      />
      <select
        value={form.phoneModelId}
        onChange={(e) => setForm((f) => ({ ...f, phoneModelId: e.target.value }))}
        className={`w-48 ${inputClass}`}
      >
        <option value="">No phone model (accessory)</option>
        {phoneModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.brand.name} {model.name}
          </option>
        ))}
      </select>
      <select
        value={form.caseTypeId}
        onChange={(e) => setForm((f) => ({ ...f, caseTypeId: e.target.value }))}
        className={`w-48 ${inputClass}`}
      >
        <option value="">No case type</option>
        {caseTypes.map((caseType) => (
          <option key={caseType.id} value={caseType.id}>
            {caseType.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isUnlimitedStock}
          onChange={(e) =>
            setForm((f) => ({ ...f, isUnlimitedStock: e.target.checked, stockItemId: "" }))
          }
          className="size-4 accent-accent"
        />
        Unlimited stock
      </label>
      <select
        disabled={form.isUnlimitedStock}
        value={form.stockItemId}
        onChange={(e) => setForm((f) => ({ ...f, stockItemId: e.target.value }))}
        className={`w-48 ${inputClass} disabled:opacity-50`}
      >
        <option value="">No stock item</option>
        {stockItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.sku} ({item.onHand - item.reserved} available)
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          className="size-4 accent-accent"
        />
        Active
      </label>
      <button type="submit" disabled={disabled} className={buttonClass}>
        {submitLabel}
      </button>
    </form>
  );
}
