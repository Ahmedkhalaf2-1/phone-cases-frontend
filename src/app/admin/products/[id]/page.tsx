"use client";

import Link from "next/link";
import { Fragment, use, useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { apiGet } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import {
  PRODUCT_STATUS_HINT,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_STYLE,
  priceSummary,
  primaryImageUrl,
} from "@/lib/admin/product-display";
import { LoadingRow } from "@/components/ui/Spinner";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { ProductMediaManager } from "@/components/admin/ProductMediaManager";
import { upsertCatalogProduct } from "@/lib/admin/catalog-store";
import type { AdminCollection, AdminProduct, AdminVariant, ProductStatus, StockItem } from "@/lib/admin/types";
import type { CaseType, PhoneModel } from "@/lib/api/types";

const STATUS_VALUES: ProductStatus[] = ["PUBLISHED", "DRAFT", "ARCHIVED"];
const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondaryButtonClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors enabled:hover:border-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const SECTIONS = [
  { id: "basic", label: "Basic information" },
  { id: "pricing", label: "Pricing" },
  { id: "images", label: "Product images" },
  { id: "variants", label: "Variants" },
  { id: "personalization", label: "Personalization" },
  { id: "inventory", label: "Inventory" },
] as const;

interface VariantFormState {
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  phoneModelId: string;
  caseTypeId: string;
  isUnlimitedStock: boolean;
  stockItemId: string;
  isActive: boolean;
  isPersonalizable: boolean;
  customizationPrice: number | null;
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
  isPersonalizable: false,
  customizationPrice: null,
};

export default function AdminProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ collection?: string }>;
}) {
  const { id } = use(params);
  const { collection: fromCollectionId } = use(searchParams);
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [phoneModels, setPhoneModels] = useState<PhoneModel[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [attachCollectionId, setAttachCollectionId] = useState("");

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editNameEn, setEditNameEn] = useState("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editDescriptionEn, setEditDescriptionEn] = useState("");
  const [editDescriptionAr, setEditDescriptionAr] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const [newVariant, setNewVariant] = useState<VariantFormState>(EMPTY_VARIANT_FORM);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariantForm, setEditVariantForm] = useState<VariantFormState>(EMPTY_VARIANT_FORM);

  // Bulk generation state for Add Variant
  const [applyToAllModels, setApplyToAllModels] = useState(false);
  const [applyToAllCaseTypes, setApplyToAllCaseTypes] = useState(false);
  const [modelBrandFilter, setModelBrandFilter] = useState<string>("ALL");
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Filter state for Variants table
  const [variantSearch, setVariantSearch] = useState("");
  const [variantFilterBrand, setVariantFilterBrand] = useState("ALL");
  const [variantFilterCaseType, setVariantFilterCaseType] = useState("ALL");

  useEffect(() => {
    // Always the real backend's public catalog, regardless of storefront
    // demo mode — this is staff creating real variants against real data.
    apiGet<PhoneModel[]>("/phone-models").then(setPhoneModels).catch(() => {});
    apiGet<CaseType[]>("/case-types").then(setCaseTypes).catch(() => {});
  }, []);

  const loadProduct = useCallback(async () => {
    try {
      setProduct(await authorizedFetch((token) => adminClient.getProduct(token, id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load product.");
    }
  }, [authorizedFetch, id]);

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

  // Keep the shared admin grids in sync with edits made here.
  useEffect(() => {
    if (product) upsertCatalogProduct(product);
  }, [product]);

  // Pre-fill default price from product basePrice for new variants
  useEffect(() => {
    if (product?.basePrice && newVariant.price === null) {
      setNewVariant((prev) => ({
        ...prev,
        price: prev.price ?? product.basePrice,
        isUnlimitedStock: true,
      }));
    }
  }, [product?.basePrice, newVariant.price]);

  function flash(message: string) {
    setError(null);
    setNotice(message);
  }

  const phoneBrands = useMemo(() => {
    const map = new Map<string, { id: string; slug: string; name: string }>();
    for (const m of phoneModels) {
      if (m.brand) map.set(m.brand.slug, m.brand);
    }
    return Array.from(map.values());
  }, [phoneModels]);

  const targetModels: (PhoneModel | null)[] = useMemo(() => {
    if (applyToAllModels) {
      return modelBrandFilter === "ALL"
        ? phoneModels
        : phoneModels.filter((m) => m.brand.slug === modelBrandFilter);
    }
    if (newVariant.phoneModelId) {
      const found = phoneModels.find((m) => m.id === newVariant.phoneModelId);
      return found ? [found] : [null];
    }
    return [null];
  }, [applyToAllModels, modelBrandFilter, phoneModels, newVariant.phoneModelId]);

  const targetCaseTypes: (CaseType | null)[] = useMemo(() => {
    if (applyToAllCaseTypes) {
      return caseTypes;
    }
    if (newVariant.caseTypeId) {
      const found = caseTypes.find((c) => c.id === newVariant.caseTypeId);
      return found ? [found] : [null];
    }
    return [null];
  }, [applyToAllCaseTypes, caseTypes, newVariant.caseTypeId]);

  const existingCombos = useMemo(() => {
    const set = new Set<string>();
    for (const v of product?.variants ?? []) {
      set.add(`${v.phoneModelId ?? "none"}:${v.caseTypeId ?? "none"}`);
    }
    return set;
  }, [product?.variants]);

  const existingSkus = useMemo(() => {
    return new Set((product?.variants ?? []).map((v) => v.sku.toUpperCase()));
  }, [product?.variants]);

  const pendingCombos = useMemo(() => {
    const list: { model: PhoneModel | null; caseType: CaseType | null }[] = [];
    for (const model of targetModels) {
      for (const ct of targetCaseTypes) {
        const key = `${model?.id ?? "none"}:${ct?.id ?? "none"}`;
        if (!existingCombos.has(key)) {
          list.push({ model, caseType: ct });
        }
      }
    }
    return list;
  }, [targetModels, targetCaseTypes, existingCombos]);

  const isBulkMode = applyToAllModels || applyToAllCaseTypes;
  const totalCombosCount = targetModels.length * targetCaseTypes.length;
  const skippedCombosCount = totalCombosCount - pendingCombos.length;

  function generateSkuForCombo(
    userPrefix: string,
    productSlug: string,
    model: PhoneModel | null,
    caseType: CaseType | null,
    usedSkus: Set<string>,
  ): string {
    const prefix = (userPrefix.trim() || productSlug)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "-")
      .replace(/-+/g, "-");

    const parts = [prefix];
    if (model) {
      parts.push(model.slug.toUpperCase().replace(/[^A-Z0-9_-]/g, "-"));
    }
    if (caseType) {
      parts.push(caseType.slug.toUpperCase().replace(/[^A-Z0-9_-]/g, "-"));
    }
    const baseSku = parts.join("-");
    let candidate = baseSku;
    let counter = 1;
    while (usedSkus.has(candidate.toUpperCase())) {
      counter++;
      candidate = `${baseSku}-${counter}`;
    }
    usedSkus.add(candidate.toUpperCase());
    return candidate;
  }

  /**
   * Personalization fields are only sent when they change, so variant
   * edits keep working even if the backend's admin DTO doesn't accept them.
   */
  function variantInputFromForm(form: VariantFormState, original?: AdminVariant) {
    const personalization: { isPersonalizable?: boolean; customizationPrice?: number } = {};
    if (form.isPersonalizable !== (original?.isPersonalizable ?? false)) {
      personalization.isPersonalizable = form.isPersonalizable;
    }
    if ((form.customizationPrice ?? 0) !== (original?.customizationPrice ?? 0)) {
      personalization.customizationPrice = form.customizationPrice ?? 0;
    }
    return {
      ...personalization,
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

  function variantLabel(variant: AdminVariant) {
    const model = phoneModels.find((m) => m.id === variant.phoneModelId);
    const caseType = caseTypes.find((c) => c.id === variant.caseTypeId);
    return (
      [model ? `${model.brand.name} ${model.name}` : null, caseType?.name].filter(Boolean).join(" · ") ||
      "Accessory (no phone model)"
    );
  }

  async function handleAddVariant(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !product) return;
    if (newVariant.price === null) {
      setError("Enter the variant's price.");
      return;
    }

    if (!isBulkMode) {
      if (!newVariant.sku.trim()) {
        setError("Enter a SKU for this variant.");
        return;
      }
      setIsBusy(true);
      setError(null);
      try {
        await authorizedFetch((token) =>
          adminClient.createVariant(token, id, variantInputFromForm(newVariant)),
        );
        setNewVariant((prev) => ({
          ...EMPTY_VARIANT_FORM,
          price: product.basePrice ?? null,
          isUnlimitedStock: true,
        }));
        await loadProduct();
        flash("Variant added.");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not add variant.");
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (pendingCombos.length === 0) {
      setError("All selected combinations already exist for this product.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setBulkProgress({ current: 0, total: pendingCombos.length });

    const usedSkus = new Set(existingSkus);
    let createdCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 4;
    for (let i = 0; i < pendingCombos.length; i += BATCH_SIZE) {
      const batch = pendingCombos.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ model, caseType }) => {
          const sku = generateSkuForCombo(
            newVariant.sku,
            product.slug,
            model,
            caseType,
            usedSkus,
          );

          try {
            await authorizedFetch((token) =>
              adminClient.createVariant(token, id, {
                sku,
                price: newVariant.price ?? 0,
                compareAtPrice: newVariant.compareAtPrice ?? undefined,
                phoneModelId: model?.id,
                caseTypeId: caseType?.id,
                isActive: newVariant.isActive,
                isUnlimitedStock: newVariant.isUnlimitedStock,
                stockItemId: newVariant.isUnlimitedStock ? undefined : newVariant.stockItemId || undefined,
                isPersonalizable: newVariant.isPersonalizable,
                customizationPrice: newVariant.isPersonalizable ? newVariant.customizationPrice ?? 0 : undefined,
              }),
            );
            createdCount++;
          } catch (err) {
            failedCount++;
            const msg = err instanceof ApiError ? err.message : "Could not add variant";
            if (!errors.includes(msg)) errors.push(msg);
          } finally {
            setBulkProgress((prev) =>
              prev ? { ...prev, current: createdCount + failedCount } : null,
            );
          }
        }),
      );
    }

    setBulkProgress(null);
    setIsBusy(false);
    await loadProduct();

    if (createdCount > 0 && failedCount === 0) {
      flash(`Successfully created all ${createdCount} variants.`);
      setNewVariant((prev) => ({
        ...EMPTY_VARIANT_FORM,
        price: product.basePrice ?? null,
        isUnlimitedStock: true,
      }));
    } else if (createdCount > 0 && failedCount > 0) {
      flash(`Created ${createdCount} variants (${failedCount} failed: ${errors.join(", ")}).`);
    } else {
      setError(`Failed to create variants: ${errors.join(", ")}`);
    }
  }

  async function handleBulkSetVariantsActive(isActive: boolean) {
    if (!accessToken || !product || product.variants.length === 0) return;
    const toChange = product.variants.filter((v) => v.isActive !== isActive);
    if (toChange.length === 0) return;
    setIsBusy(true);
    setError(null);
    try {
      for (const v of toChange) {
        await authorizedFetch((token) =>
          adminClient.updateVariant(token, id, v.id, { isActive }),
        );
      }
      await loadProduct();
      flash(isActive ? "All variants activated." : "All variants deactivated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update variants.");
    } finally {
      setIsBusy(false);
    }
  }

  const filteredVariants = useMemo(() => {
    if (!product?.variants) return [];
    return product.variants.filter((variant) => {
      if (variantFilterBrand !== "ALL") {
        const model = phoneModels.find((m) => m.id === variant.phoneModelId);
        if (model?.brand.slug !== variantFilterBrand) return false;
      }
      if (variantFilterCaseType !== "ALL") {
        if (variant.caseTypeId !== variantFilterCaseType) return false;
      }
      if (variantSearch.trim()) {
        const query = variantSearch.toLowerCase();
        const label = variantLabel(variant).toLowerCase();
        const sku = variant.sku.toLowerCase();
        if (!label.includes(query) && !sku.includes(query)) return false;
      }
      return true;
    });
  }, [product?.variants, variantFilterBrand, variantFilterCaseType, variantSearch, phoneModels, caseTypes]);

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
      isPersonalizable: variant.isPersonalizable ?? false,
      customizationPrice: variant.customizationPrice ?? null,
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
        adminClient.updateVariant(
          token,
          id,
          editingVariantId,
          variantInputFromForm(editVariantForm, product?.variants.find((v) => v.id === editingVariantId)),
        ),
      );
      setEditingVariantId(null);
      await loadProduct();
      flash("Variant saved.");
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
      await loadProduct();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update variant.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSavePrices(changes: { variantId: string; price: number; compareAtPrice: number | null }[]) {
    setIsBusy(true);
    setError(null);
    try {
      for (const change of changes) {
        await authorizedFetch((token) =>
          adminClient.updateVariant(token, id, change.variantId, {
            price: change.price,
            // null clears a previous "was" price.
            compareAtPrice: change.compareAtPrice,
          }),
        );
      }
      await loadProduct();
      flash(changes.length === 1 ? "Price saved." : `${changes.length} prices saved.`);
    } catch (err) {
      await loadProduct();
      setError(err instanceof ApiError ? err.message : "Could not save prices.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStatusChange(status: ProductStatus) {
    if (!accessToken || product?.status === status) return;
    setIsBusy(true);
    try {
      const updated = await authorizedFetch((token) => adminClient.updateProductStatus(token, id, status));
      // The status endpoint's response omits variants/media/collections —
      // merge onto existing state instead of replacing it, or the sections
      // below would crash.
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      flash(`Status changed to ${PRODUCT_STATUS_LABEL[status]}.`);
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
    setEditDescriptionAr(product.descriptionAr ?? "");
    setEditInternalNotes(product.internalNotes ?? "");
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
          descriptionAr: editDescriptionAr || undefined,
          internalNotes: editInternalNotes || undefined,
        }),
      );
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setIsEditingDetails(false);
      flash("Details saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function handleSaveBasePrice(basePrice: number | null) {
    setIsBusy(true);
    setError(null);
    try {
      const updated = await authorizedFetch((token) =>
        adminClient.updateProduct(token, id, { basePrice: basePrice ?? undefined }),
      );
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      flash("Base price saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the base price.");
    } finally {
      setIsBusy(false);
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
      await loadProduct();
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
      await loadProduct();
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
  const fromCollection = fromCollectionId
    ? (collections.find((c) => c.id === fromCollectionId) ??
      product.collections.find((c) => c.id === fromCollectionId))
    : undefined;
  const thumbnail = primaryImageUrl(product);
  const price = priceSummary(product);

  return (
    <div className="max-w-6xl">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        {fromCollection ? (
          <>
            <Link href="/admin/catalog/collections" className="hover:text-accent">
              Collections
            </Link>{" "}
            /{" "}
            <Link href={`/admin/catalog/collections/${fromCollection.id}`} className="hover:text-accent">
              {fromCollection.nameEn}
            </Link>
          </>
        ) : (
          <Link href="/admin/products" className="hover:text-accent">
            Products
          </Link>
        )}{" "}
        / <span className="text-ink">{product.nameEn}</span>
      </nav>

      {/* Summary */}
      <header className="mt-3 flex flex-col gap-5 rounded-card bg-surface p-4 shadow-card sm:flex-row sm:p-6">
        <a
          href="#images"
          className="relative block aspect-square w-full shrink-0 overflow-hidden rounded-card-inner bg-background sm:w-48"
          title="Go to product images"
        >
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center p-4 text-center text-sm font-semibold text-amber-800">
              No image yet — add one below
            </span>
          )}
        </a>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{product.nameEn}</h1>
            <p dir="rtl" className="text-start text-sm text-muted-foreground">
              {product.nameAr}
            </p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Price</dt>
              <dd className="text-lg font-semibold text-ink">
                {price ?? <span className="text-amber-700">No price yet — add a variant</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Collection</dt>
              <dd className="flex flex-wrap gap-1.5 pt-0.5">
                {product.collections.length === 0 && <span className="text-amber-700">Not in any collection</span>}
                {product.collections.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/catalog/collections/${c.id}`}
                    className="rounded-full bg-accent-wash px-2.5 py-0.5 text-xs font-semibold text-ink hover:underline"
                  >
                    {c.nameEn}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <div role="radiogroup" aria-label="Status" className="mt-1 flex flex-wrap gap-1.5">
              {STATUS_VALUES.map((status) => {
                const isCurrent = product.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={isCurrent}
                    disabled={isBusy}
                    onClick={() => handleStatusChange(status)}
                    title={PRODUCT_STATUS_HINT[status]}
                    className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isCurrent
                        ? `${PRODUCT_STATUS_STYLE[status]} ring-2 ring-current`
                        : "bg-background text-muted-foreground hover:text-ink"
                    }`}
                  >
                    {PRODUCT_STATUS_LABEL[status]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{PRODUCT_STATUS_HINT[product.status]}</p>
          </div>
          {product.status === "PUBLISHED" && (
            <Link
              href={`/products/${product.slug}`}
              target="_blank"
              className="self-start text-sm font-semibold text-accent underline underline-offset-4"
            >
              View in shop ↗
            </Link>
          )}
        </div>
      </header>

      {/* Section nav */}
      <nav
        aria-label="Sections"
        className="sticky top-0 z-10 -mx-4 mt-4 flex gap-1.5 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-pill sm:px-2"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-pill px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div aria-live="polite">
        {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && !error && <p className="mt-3 text-sm font-semibold text-green-700">✓ {notice}</p>}
      </div>

      {/* Basic information */}
      <Section id="basic" title="Basic information">
        {!isEditingDetails ? (
          <>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Name (English)">{product.nameEn}</Detail>
              <Detail label="الاسم (عربي)" rtl>
                {product.nameAr}
              </Detail>
              <Detail label="Description (English)">{product.descriptionEn}</Detail>
              <Detail label="الوصف (عربي)" rtl>
                {product.descriptionAr}
              </Detail>
              <Detail label="Web address">/products/{product.slug}</Detail>
              <Detail label="Internal notes (staff only)">{product.internalNotes}</Detail>
            </dl>
            <button type="button" onClick={startEditingDetails} className={`${secondaryButtonClass} mt-4`}>
              Edit basic information
            </button>
          </>
        ) : (
          <form onSubmit={handleSaveDetails} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (English)">
              <input required value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} className={inputClass} />
            </Field>
            <Field label="الاسم (عربي)">
              <input
                required
                dir="rtl"
                value={editNameAr}
                onChange={(e) => setEditNameAr(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Description (English)">
              <textarea
                rows={3}
                value={editDescriptionEn}
                onChange={(e) => setEditDescriptionEn(e.target.value)}
                className={`${inputClass} rounded-2xl`}
              />
            </Field>
            <Field label="الوصف (عربي)">
              <textarea
                rows={3}
                dir="rtl"
                value={editDescriptionAr}
                onChange={(e) => setEditDescriptionAr(e.target.value)}
                className={`${inputClass} rounded-2xl`}
              />
            </Field>
            <Field label="Internal notes (staff only)">
              <textarea
                rows={2}
                value={editInternalNotes}
                onChange={(e) => setEditInternalNotes(e.target.value)}
                className={`${inputClass} rounded-2xl`}
              />
            </Field>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={isSavingDetails} className={buttonClass}>
                {isSavingDetails ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={() => setIsEditingDetails(false)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <h3 className="mt-8 text-sm font-semibold text-ink">Collections</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {product.collections.map((collection) => (
            <span
              key={collection.id}
              className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase"
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
          <form onSubmit={handleAttachCollection} className="mt-2 flex flex-wrap gap-2">
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
      </Section>

      {/* Pricing */}
      <Section
        id="pricing"
        title="Pricing"
        description="Customers pay the price of the phone model / case type they pick. Most designs use one price for every model."
      >
        <PricingEditor
          key={product.variants.map((v) => `${v.id}:${v.price}:${v.compareAtPrice}`).join("|")}
          variants={product.variants}
          currency={product.currency}
          labelFor={variantLabel}
          caseTypes={caseTypes}
          phoneBrands={phoneBrands}
          disabled={isBusy}
          onSave={handleSavePrices}
        />
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">Base price (reference only)</summary>
          <p className="mt-2 max-w-xl text-xs text-muted-foreground">
            Stored on the product for reference. The shop doesn&apos;t show it — customers always pay the variant
            prices above.
          </p>
          <BasePriceEditor
            key={product.basePrice ?? "none"}
            basePrice={product.basePrice}
            disabled={isBusy}
            onSave={handleSaveBasePrice}
          />
        </details>
      </Section>

      {/* Images */}
      <Section id="images" title="Product images">
        <ProductMediaManager product={product} onChanged={loadProduct} />
      </Section>

      {/* Variants */}
      <Section
        id="variants"
        title="Variants"
        description="One variant per phone model / case type this design is sold for."
      >
        {product.variants.length === 0 ? (
          <div className="mb-6 rounded-2xl border-2 border-dashed border-accent/30 bg-accent-wash/30 p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-wash text-xl">
              📱
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink">No variants yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Phone cases usually sell across multiple phone models and case types. You can quickly generate variants for all phone models and case types in one click.
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setApplyToAllModels(true);
                setApplyToAllCaseTypes(true);
                setNewVariant((prev) => ({
                  ...prev,
                  price: prev.price ?? product.basePrice,
                  isUnlimitedStock: true,
                }));
              }}
              className={`${buttonClass} mt-4 inline-flex items-center gap-2 shadow-sm`}
            >
              ⚡ Setup for all phone models & case types
            </button>
          </div>
        ) : (
          <>
            {/* Table Filters & Bulk Actions */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Filter by SKU or model…"
                  value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)}
                  className={`w-48 ${inputClass}`}
                />
                <select
                  value={variantFilterBrand}
                  onChange={(e) => setVariantFilterBrand(e.target.value)}
                  className={`w-36 ${inputClass}`}
                >
                  <option value="ALL">All brands</option>
                  {phoneBrands.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  value={variantFilterCaseType}
                  onChange={(e) => setVariantFilterCaseType(e.target.value)}
                  className={`w-36 ${inputClass}`}
                >
                  <option value="ALL">All case types</option>
                  {caseTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Showing {filteredVariants.length} of {product.variants.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy || product.variants.length === 0}
                  onClick={() => handleBulkSetVariantsActive(true)}
                  className="text-xs font-semibold text-ink hover:text-accent"
                >
                  Activate all
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  disabled={isBusy || product.variants.length === 0}
                  onClick={() => handleBulkSetVariantsActive(false)}
                  className="text-xs font-semibold text-muted-foreground hover:text-accent"
                >
                  Deactivate all
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="p-2 text-start">Phone model · case type</th>
                    <th className="p-2 text-start">SKU</th>
                    <th className="p-2 text-start">Price</th>
                    <th className="p-2 text-start">Active</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((variant) => (
                    <Fragment key={variant.id}>
                      <tr className="border-b border-border hover:bg-surface/50">
                        <td className="p-2 font-semibold text-ink">
                          {variantLabel(variant)}
                          {variant.isPersonalizable && (
                            <span className="ms-2 rounded-full bg-accent-wash px-2 py-0.5 text-[11px] font-semibold">
                              Custom image +{formatPrice(variant.customizationPrice ?? 0, variant.currency)}
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono text-xs text-muted-foreground">{variant.sku}</td>
                        <td className="p-2">{formatPrice(variant.price, variant.currency)}</td>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={variant.isActive}
                            disabled={isBusy}
                            onChange={(e) => handleToggleVariantActive(variant.id, e.target.checked)}
                            aria-label={`${variantLabel(variant)} active`}
                            className="size-4 accent-accent"
                          />
                        </td>
                        <td className="p-2 text-end">
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
                        <tr className="border-b border-border bg-background">
                          <td colSpan={5} className="p-3">
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
                    </Fragment>
                  ))}
                  {filteredVariants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No variants match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h3 className="mt-8 text-sm font-semibold text-ink">Add variants</h3>
        <div className="mt-2">
          <AddVariantPanel
            form={newVariant}
            setForm={setNewVariant}
            phoneModels={phoneModels}
            phoneBrands={phoneBrands}
            caseTypes={caseTypes}
            stockItems={stockItems}
            productSlug={product.slug}
            applyToAllModels={applyToAllModels}
            setApplyToAllModels={setApplyToAllModels}
            applyToAllCaseTypes={applyToAllCaseTypes}
            setApplyToAllCaseTypes={setApplyToAllCaseTypes}
            modelBrandFilter={modelBrandFilter}
            setModelBrandFilter={setModelBrandFilter}
            pendingCombosCount={pendingCombos.length}
            totalCombosCount={totalCombosCount}
            skippedCombosCount={skippedCombosCount}
            targetModelsCount={targetModels.length}
            targetCaseTypesCount={targetCaseTypes.length}
            bulkProgress={bulkProgress}
            onSubmit={handleAddVariant}
            disabled={isBusy}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Leaving phone model/case type unset means this variant is an
          accessory, not something &quot;compatible with every phone.&quot;
          Stock item and unlimited stock can&apos;t both be set — picking one
          clears the other.
        </p>
      </Section>

      {/* Personalization */}
      <Section id="personalization" title="Personalization">
        <h3 className="text-sm font-semibold text-ink">Customer&apos;s own image</h3>
        {product.variants.some((v) => v.isPersonalizable) ? (
          <p className="mt-1 max-w-2xl text-sm text-ink">
            {product.variants.filter((v) => v.isPersonalizable).length} of {product.variants.length} variants let
            customers upload their own image on the{" "}
            <Link href={`/customize?product=${product.slug}`} target="_blank" className="font-semibold text-accent underline underline-offset-4">
              Design your case ↗
            </Link>{" "}
            page.
          </p>
        ) : (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Off for every variant. To turn it on, click Edit on a variant under Variants and tick &quot;Customer can
            upload their own image&quot;.
          </p>
        )}
        <h3 className="mt-5 text-sm font-semibold text-ink">Personal notes</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Customers can add a note to any case when they add it to the bag (for example a name to print on the back).
          It shows on the order line in{" "}
          <Link href="/admin/orders" className="font-semibold text-accent underline underline-offset-4">
            Orders
          </Link>
          .
        </p>
      </Section>

      {/* Inventory */}
      <Section
        id="inventory"
        title="Inventory"
        description="Change which stock item a variant uses with Edit in Variants. Adjust stock counts on the Stock page."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {product.variants.map((variant) => {
            const stockItem = stockItems.find((s) => s.id === variant.stockItemId) ?? variant.stockItem;
            const available = stockItem ? stockItem.onHand - stockItem.reserved : null;
            return (
              <li key={variant.id} className="flex items-center justify-between gap-3 rounded-2xl bg-background p-3 text-sm">
                <span className="font-semibold text-ink">{variantLabel(variant)}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    variant.isUnlimitedStock
                      ? "bg-blue-100 text-blue-800"
                      : available === null
                        ? "bg-amber-100 text-amber-800"
                        : available <= 0
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                  }`}
                >
                  {variant.isUnlimitedStock
                    ? "Made to order"
                    : available === null
                      ? "No stock item"
                      : available <= 0
                        ? "Out of stock"
                        : `${available} in stock`}
                </span>
              </li>
            );
          })}
          {product.variants.length === 0 && <p className="text-sm text-muted-foreground">No variants yet.</p>}
        </ul>
        <Link href="/admin/stock" className={`${secondaryButtonClass} mt-4 inline-block`}>
          Open Stock page
        </Link>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="mt-6 scroll-mt-16 rounded-card bg-surface p-4 shadow-card sm:p-6"
    >
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {description && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}

function Detail({ label, rtl, children }: { label: string; rtl?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd dir={rtl ? "rtl" : undefined} className="text-start whitespace-pre-line text-ink">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

/**
 * Every variant's price in one place, plus "same price for all" — the
 * common case for a design sold across many phone models.
 */
function PricingEditor({
  variants,
  currency,
  labelFor,
  caseTypes,
  phoneBrands,
  disabled,
  onSave,
}: {
  variants: AdminVariant[];
  currency: string;
  labelFor: (variant: AdminVariant) => string;
  caseTypes?: CaseType[];
  phoneBrands?: { id: string; slug: string; name: string }[];
  disabled: boolean;
  onSave: (changes: { variantId: string; price: number; compareAtPrice: number | null }[]) => void;
}) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(variants.map((v) => [v.id, { price: v.price as number | null, compareAtPrice: v.compareAtPrice }])),
  );
  // MoneyInput keeps its own text; bump to remount after "apply to all".
  const [inputsVersion, setInputsVersion] = useState(0);
  const [allPrice, setAllPrice] = useState<number | null>(null);

  // Bulk by case type
  const [targetCaseTypeId, setTargetCaseTypeId] = useState("");
  const [caseTypePrice, setCaseTypePrice] = useState<number | null>(null);

  if (variants.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a variant first — prices are set per variant.</p>;
  }

  const changes = variants
    .filter((v) => {
      const d = draft[v.id];
      return d.price !== null && (d.price !== v.price || d.compareAtPrice !== v.compareAtPrice);
    })
    .map((v) => ({ variantId: v.id, price: draft[v.id].price as number, compareAtPrice: draft[v.id].compareAtPrice }));
  const hasEmpty = variants.some((v) => draft[v.id].price === null);

  const matchedCaseTypeCount = targetCaseTypeId
    ? variants.filter((v) => v.caseTypeId === targetCaseTypeId).length
    : 0;

  return (
    <div>
      {variants.length > 1 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-accent-wash/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bulk price updates
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <MoneyInput label="Same price for all" minorUnits={allPrice} onChange={setAllPrice} className="w-36" />
            <button
              type="button"
              disabled={disabled || allPrice === null}
              onClick={() => {
                setDraft((prev) =>
                  Object.fromEntries(Object.entries(prev).map(([id, d]) => [id, { ...d, price: allPrice }])),
                );
                setInputsVersion((n) => n + 1);
              }}
              className={secondaryButtonClass}
            >
              Apply to all {variants.length}
            </button>
          </div>

          {caseTypes && caseTypes.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-accent/10">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Apply by case type</label>
                <select
                  value={targetCaseTypeId}
                  onChange={(e) => setTargetCaseTypeId(e.target.value)}
                  className={`w-44 ${inputClass}`}
                >
                  <option value="">Select case type…</option>
                  {caseTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({variants.filter((v) => v.caseTypeId === c.id).length})
                    </option>
                  ))}
                </select>
              </div>
              <MoneyInput label="Price for case type" minorUnits={caseTypePrice} onChange={setCaseTypePrice} className="w-36" />
              <button
                type="button"
                disabled={disabled || !targetCaseTypeId || caseTypePrice === null || matchedCaseTypeCount === 0}
                onClick={() => {
                  setDraft((prev) => {
                    const next = { ...prev };
                    for (const v of variants) {
                      if (v.caseTypeId === targetCaseTypeId) {
                        next[v.id] = { ...next[v.id], price: caseTypePrice };
                      }
                    }
                    return next;
                  });
                  setInputsVersion((n) => n + 1);
                }}
                className={secondaryButtonClass}
              >
                Apply to {matchedCaseTypeCount} {matchedCaseTypeCount === 1 ? "variant" : "variants"}
              </button>
            </div>
          )}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {variants.map((variant) => {
          const d = draft[variant.id];
          const changed = d.price !== variant.price || d.compareAtPrice !== variant.compareAtPrice;
          return (
            <li
              key={`${variant.id}-${inputsVersion}`}
              className={`flex flex-wrap items-end gap-3 rounded-2xl p-3 ${changed ? "bg-amber-50" : "bg-background"}`}
            >
              <div className="min-w-40 flex-1">
                <p className="font-semibold text-ink">{labelFor(variant)}</p>
                <p className="text-xs text-muted-foreground">
                  Now {formatPrice(variant.price, currency)}
                  {variant.compareAtPrice !== null && ` (was ${formatPrice(variant.compareAtPrice, currency)})`}
                  {!variant.isActive && " · inactive"}
                </p>
              </div>
              <MoneyInput
                label="Price"
                minorUnits={d.price}
                onChange={(v) => setDraft((prev) => ({ ...prev, [variant.id]: { ...prev[variant.id], price: v } }))}
                className="w-36"
              />
              <MoneyInput
                label="Was (optional)"
                minorUnits={d.compareAtPrice}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, [variant.id]: { ...prev[variant.id], compareAtPrice: v } }))
                }
                className="w-36"
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || changes.length === 0 || hasEmpty}
          onClick={() => onSave(changes)}
          className={buttonClass}
        >
          {changes.length > 1 ? `Save ${changes.length} prices` : "Save price"}
        </button>
        {changes.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft(
                Object.fromEntries(variants.map((v) => [v.id, { price: v.price as number | null, compareAtPrice: v.compareAtPrice }])),
              );
              setInputsVersion((n) => n + 1);
            }}
            className={secondaryButtonClass}
          >
            Undo changes
          </button>
        )}
        {hasEmpty && <span className="text-sm text-amber-700">Every variant needs a price.</span>}
        <span className="text-xs text-muted-foreground">
          &quot;Was&quot; shows as a crossed-out price next to the real one.
        </span>
      </div>
    </div>
  );
}

function BasePriceEditor({
  basePrice,
  disabled,
  onSave,
}: {
  basePrice: number | null;
  disabled: boolean;
  onSave: (basePrice: number | null) => void;
}) {
  const [value, setValue] = useState(basePrice);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <MoneyInput label="Base price" minorUnits={value} onChange={setValue} className="w-36" />
      <button
        type="button"
        disabled={disabled || value === basePrice}
        onClick={() => onSave(value)}
        className={secondaryButtonClass}
      >
        Save base price
      </button>
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
          checked={form.isPersonalizable}
          onChange={(e) => setForm((f) => ({ ...f, isPersonalizable: e.target.checked }))}
          className="size-4 accent-accent"
        />
        Customer can upload their own image
      </label>
      {form.isPersonalizable && (
        <MoneyInput
          label="Design surcharge"
          minorUnits={form.customizationPrice}
          onChange={(v) => setForm((f) => ({ ...f, customizationPrice: v }))}
          className="w-32"
        />
      )}
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

function AddVariantPanel({
  form,
  setForm,
  phoneModels,
  phoneBrands,
  caseTypes,
  stockItems,
  productSlug,
  applyToAllModels,
  setApplyToAllModels,
  applyToAllCaseTypes,
  setApplyToAllCaseTypes,
  modelBrandFilter,
  setModelBrandFilter,
  pendingCombosCount,
  totalCombosCount,
  skippedCombosCount,
  targetModelsCount,
  targetCaseTypesCount,
  bulkProgress,
  onSubmit,
  disabled,
}: {
  form: VariantFormState;
  setForm: (updater: (prev: VariantFormState) => VariantFormState) => void;
  phoneModels: PhoneModel[];
  phoneBrands: { id: string; slug: string; name: string }[];
  caseTypes: CaseType[];
  stockItems: StockItem[];
  productSlug: string;
  applyToAllModels: boolean;
  setApplyToAllModels: (val: boolean) => void;
  applyToAllCaseTypes: boolean;
  setApplyToAllCaseTypes: (val: boolean) => void;
  modelBrandFilter: string;
  setModelBrandFilter: (val: string) => void;
  pendingCombosCount: number;
  totalCombosCount: number;
  skippedCombosCount: number;
  targetModelsCount: number;
  targetCaseTypesCount: number;
  bulkProgress: { current: number; total: number } | null;
  onSubmit: (event: React.FormEvent) => void;
  disabled: boolean;
}) {
  const isBulkMode = applyToAllModels || applyToAllCaseTypes;

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
      {/* Toggles bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-accent-wash/60 p-3 text-sm">
        <span className="font-semibold text-ink">Scope:</span>
        <label className="flex items-center gap-2 cursor-pointer font-medium text-ink select-none">
          <input
            type="checkbox"
            checked={applyToAllModels}
            disabled={disabled}
            onChange={(e) => setApplyToAllModels(e.target.checked)}
            className="size-4 accent-accent"
          />
          Apply to all phone models ({phoneModels.length})
        </label>
        <label className="flex items-center gap-2 cursor-pointer font-medium text-ink select-none">
          <input
            type="checkbox"
            checked={applyToAllCaseTypes}
            disabled={disabled}
            onChange={(e) => setApplyToAllCaseTypes(e.target.checked)}
            className="size-4 accent-accent"
          />
          Apply to all case types ({caseTypes.length})
        </label>
        <div className="ms-auto flex items-center gap-3">
          {!applyToAllModels || !applyToAllCaseTypes ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setApplyToAllModels(true);
                setApplyToAllCaseTypes(true);
                setForm((f) => ({ ...f, isUnlimitedStock: true }));
              }}
              className="text-xs font-semibold text-accent hover:underline"
            >
              ⚡ Select all models & case types
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setApplyToAllModels(false);
                setApplyToAllCaseTypes(false);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-ink"
            >
              Single variant mode
            </button>
          )}
        </div>
      </div>

      {/* Bulk Preview Card */}
      {isBulkMode && (
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent-wash/40 p-3.5 text-sm text-ink">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-ink">
              ⚡ Bulk generation: {targetModelsCount} phone {targetModelsCount === 1 ? "model" : "models"} × {targetCaseTypesCount} case {targetCaseTypesCount === 1 ? "type" : "types"}
            </span>
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
              {pendingCombosCount} new {pendingCombosCount === 1 ? "variant" : "variants"} to create
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {skippedCombosCount > 0 ? (
              <>
                <strong className="text-ink">{pendingCombosCount}</strong> variants will be created.{" "}
                <span className="text-amber-700 font-medium">{skippedCombosCount} existing combinations will be skipped</span> to avoid duplicates.
              </>
            ) : (
              <>All {pendingCombosCount} combinations are new and will be generated.</>
            )}
            {" "}Sample SKU: <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-ink font-semibold">{(form.sku.trim() || productSlug).toUpperCase()}-[MODEL]-[CASETYPE]</code>
          </p>
        </div>
      )}

      {/* Inputs */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Phone model selection / Brand filter */}
        {applyToAllModels ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Phone models brand</label>
            <select
              value={modelBrandFilter}
              disabled={disabled}
              onChange={(e) => setModelBrandFilter(e.target.value)}
              className={`w-48 ${inputClass}`}
            >
              <option value="ALL">All brands ({phoneModels.length} models)</option>
              {phoneBrands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name} only ({phoneModels.filter((m) => m.brand.slug === b.slug).length})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Phone model</label>
            <select
              value={form.phoneModelId}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, phoneModelId: e.target.value }))}
              className={`w-48 ${inputClass}`}
            >
              <option value="">No phone model (accessory)</option>
              {phoneBrands.map((brand) => (
                <optgroup key={brand.slug} label={brand.name}>
                  {phoneModels
                    .filter((m) => m.brand.slug === brand.slug)
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* Case type selection */}
        {applyToAllCaseTypes ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Case type</label>
            <div className={`flex h-[38px] w-48 items-center rounded-pill border border-border bg-accent-wash/30 px-4 text-xs font-semibold text-ink`}>
              All case types ({caseTypes.length})
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Case type</label>
            <select
              value={form.caseTypeId}
              disabled={disabled}
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
          </div>
        )}

        {/* SKU or Prefix */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">
            {isBulkMode ? "SKU Prefix (optional)" : "SKU"}
          </label>
          <input
            required={!isBulkMode}
            placeholder={isBulkMode ? `Defaults to: ${productSlug.toUpperCase()}` : "SKU (e.g. IPH15-CLR)"}
            value={form.sku}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            className={`w-44 ${inputClass}`}
          />
        </div>

        {/* Price & CompareAt */}
        <MoneyInput
          label="Price"
          minorUnits={form.price}
          onChange={(v) => setForm((f) => ({ ...f, price: v }))}
          className="w-32"
        />
        <MoneyInput
          label="Was (optional)"
          minorUnits={form.compareAtPrice}
          onChange={(v) => setForm((f) => ({ ...f, compareAtPrice: v }))}
          className="w-32"
        />

        {/* Stock */}
        <label className="flex items-center gap-2 text-sm font-medium text-ink select-none pb-2">
          <input
            type="checkbox"
            checked={form.isUnlimitedStock}
            disabled={disabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, isUnlimitedStock: e.target.checked, stockItemId: "" }))
            }
            className="size-4 accent-accent"
          />
          Unlimited stock
        </label>
        {!form.isUnlimitedStock && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Stock item</label>
            <select
              value={form.stockItemId}
              disabled={disabled || form.isUnlimitedStock}
              onChange={(e) => setForm((f) => ({ ...f, stockItemId: e.target.value }))}
              className={`w-44 ${inputClass} disabled:opacity-50`}
            >
              <option value="">No stock item</option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} ({item.onHand - item.reserved} avail)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Customization */}
        <label className="flex items-center gap-2 text-sm font-medium text-ink select-none pb-2">
          <input
            type="checkbox"
            checked={form.isPersonalizable}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, isPersonalizable: e.target.checked }))}
            className="size-4 accent-accent"
          />
          Custom image upload
        </label>
        {form.isPersonalizable && (
          <MoneyInput
            label="Design surcharge"
            minorUnits={form.customizationPrice}
            onChange={(v) => setForm((f) => ({ ...f, customizationPrice: v }))}
            className="w-32"
          />
        )}

        {/* Active status */}
        <label className="flex items-center gap-2 text-sm font-medium text-ink select-none pb-2">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="size-4 accent-accent"
          />
          Active
        </label>

        {/* Progress bar or Submit button */}
        {bulkProgress ? (
          <div className="flex items-center gap-3 py-1">
            <div className="h-2.5 w-32 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-ink">
              Creating {bulkProgress.current}/{bulkProgress.total}…
            </span>
          </div>
        ) : (
          <button
            type="submit"
            disabled={disabled || (isBulkMode && pendingCombosCount === 0)}
            className={buttonClass}
          >
            {isBulkMode ? `Create ${pendingCombosCount} variants` : "Add variant"}
          </button>
        )}
      </div>
    </form>
  );
}
