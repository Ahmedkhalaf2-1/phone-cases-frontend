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
  priceSummary,
  primaryImageUrl,
} from "@/lib/admin/product-display";
import { LoadingRow } from "@/components/ui/Spinner";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { Switch } from "@/components/admin/form-kit";
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
type SectionId = (typeof SECTIONS)[number]["id"];

const SECTION_ICON: Record<SectionId, string> = {
  basic: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  pricing: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  images: "M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 19",
  variants: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  personalization: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  inventory: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
};

function SectionIcon({ id, className = "size-4" }: { id: SectionId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d={SECTION_ICON[id]} />
    </svg>
  );
}

type ModelScope = "all" | "brands" | "one";

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
  const [activeSection, setActiveSection] = useState<SectionId>("basic");

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

  // Which phone models / case types "Add variants" creates combinations for.
  const [modelScope, setModelScope] = useState<ModelScope>("all");
  const [scopeBrandSlugs, setScopeBrandSlugs] = useState<string[]>([]);
  /** null = every case type (the default, and stays "every" as new ones are added). */
  const [scopeCaseTypeIds, setScopeCaseTypeIds] = useState<string[] | null>(null);
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
      .then((loaded) => {
        setProduct(loaded);
        // Pre-fill new variants with the product's starting price.
        if (loaded.basePrice) {
          setNewVariant((prev) =>
            prev.price === null ? { ...prev, price: loaded.basePrice, isUnlimitedStock: true } : prev,
          );
        }
      })
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

  // Highlight the section currently in view in the sticky section menu.
  const hasProduct = product !== null;
  useEffect(() => {
    if (!hasProduct) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current: SectionId = SECTIONS[0].id;
        for (const section of SECTIONS) {
          const el = document.getElementById(section.id);
          if (el && el.getBoundingClientRect().top <= 140) current = section.id;
        }
        // At the very bottom the last sections can't reach the top.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          current = SECTIONS[SECTIONS.length - 1].id;
        }
        setActiveSection(current);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("hashchange", update);
    };
  }, [hasProduct]);

  // Keep the shared admin grids in sync with edits made here.
  useEffect(() => {
    if (product) upsertCatalogProduct(product);
  }, [product]);


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
    if (modelScope === "all") return phoneModels;
    if (modelScope === "brands") return phoneModels.filter((m) => scopeBrandSlugs.includes(m.brand.slug));
    const found = phoneModels.find((m) => m.id === newVariant.phoneModelId);
    return [found ?? null];
  }, [modelScope, scopeBrandSlugs, phoneModels, newVariant.phoneModelId]);

  const targetCaseTypes: (CaseType | null)[] = useMemo(() => {
    const picked = scopeCaseTypeIds === null ? caseTypes : caseTypes.filter((c) => scopeCaseTypeIds.includes(c.id));
    return picked.length > 0 ? picked : [null];
  }, [scopeCaseTypeIds, caseTypes]);

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
      // null clears an existing "was" price (ends the sale).
      compareAtPrice: form.compareAtPrice ?? (original?.compareAtPrice != null ? null : undefined),
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
    if (newVariant.compareAtPrice !== null && newVariant.compareAtPrice <= newVariant.price) {
      setError("The old (“was”) price must be higher than the selling price.");
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
      flash(createdCount === 1 ? "Variant added." : `Created ${createdCount} variants.`);
      // Keep price / was / stock settings so the next batch can reuse them.
      setNewVariant((prev) => ({ ...prev, sku: "", phoneModelId: "" }));
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
      <header id="top" className="mt-3 scroll-mt-4 rounded-card bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row">
          <a
            href="#images"
            className="group relative block aspect-square w-full shrink-0 overflow-hidden rounded-card-inner bg-background sm:w-44"
            title="Go to product images"
          >
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm font-semibold text-muted-foreground">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink">
                  <SectionIcon id="images" className="size-5" />
                </span>
                Add a photo
              </span>
            )}
          </a>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-3xl leading-tight tracking-tight break-words text-ink sm:text-4xl">
                  {product.nameEn}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span dir="rtl">{product.nameAr}</span>
                  <span className="mx-1.5">·</span>
                  <span>/products/{product.slug}</span>
                </p>
              </div>
              {product.status === "PUBLISHED" && (
                <Link
                  href={`/products/${product.slug}`}
                  target="_blank"
                  className={`${secondaryButtonClass} shrink-0`}
                >
                  View in shop ↗
                </Link>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <a href="#pricing" className="rounded-2xl bg-background p-3 transition-colors hover:bg-border/50">
                <dt className="text-xs text-muted-foreground">Price</dt>
                <dd className={`mt-0.5 font-semibold ${price ? "text-ink" : "text-amber-700"}`}>{price ?? "Not set yet"}</dd>
              </a>
              <a href="#variants" className="rounded-2xl bg-background p-3 transition-colors hover:bg-border/50">
                <dt className="text-xs text-muted-foreground">Variants</dt>
                <dd className={`mt-0.5 font-semibold ${product.variants.length ? "text-ink" : "text-amber-700"}`}>
                  {product.variants.length
                    ? `${product.variants.filter((v) => v.isActive).length} of ${product.variants.length} on`
                    : "None yet"}
                </dd>
              </a>
              <a href="#basic" className="col-span-2 rounded-2xl bg-background p-3 transition-colors hover:bg-border/50 sm:col-span-1">
                <dt className="text-xs text-muted-foreground">Collection</dt>
                <dd className={`mt-0.5 truncate font-semibold ${product.collections.length ? "text-ink" : "text-amber-700"}`}>
                  {product.collections.length ? product.collections.map((c) => c.nameEn).join(", ") : "None yet"}
                </dd>
              </a>
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <div role="radiogroup" aria-label="Status" className="inline-flex gap-1 rounded-pill bg-background p-1">
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
                      className={`flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                        isCurrent ? "bg-ink text-white" : "text-muted-foreground hover:text-ink"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${
                          status === "PUBLISHED" ? "bg-green-500" : status === "DRAFT" ? "bg-amber-400" : "bg-muted-foreground/60"
                        }`}
                      />
                      {PRODUCT_STATUS_LABEL[status]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{PRODUCT_STATUS_HINT[product.status]}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Setup checklist */}
      {(() => {
        const steps = [
          { done: (product.media?.length ?? 0) > 0, label: "Add a photo", href: "#images" },
          { done: product.variants.length > 0, label: "Add variants", href: "#variants" },
          { done: product.variants.some((v) => v.isActive), label: "Turn on a variant", href: "#variants" },
          { done: product.collections.length > 0, label: "Put it in a collection", href: "#basic" },
          { done: product.status === "PUBLISHED", label: "Make it Active", href: "#top" },
        ];
        const doneCount = steps.filter((st) => st.done).length;
        if (doneCount === steps.length) return null;
        return (
          <section aria-label="Setup checklist" className="mt-4 rounded-card bg-surface p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Get it ready for the shop</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {doneCount} of {steps.length} done
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-3 flex flex-wrap gap-2">
              {steps.map((st) => (
                <li key={st.label}>
                  <a
                    href={st.href}
                    className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
                      st.done ? "bg-green-100 text-green-800" : "bg-background text-ink hover:bg-border/60"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
                        st.done ? "bg-green-700 text-white" : "border border-muted-foreground/50"
                      }`}
                    >
                      {st.done ? "✓" : ""}
                    </span>
                    <span className={st.done ? "line-through decoration-green-800/40" : ""}>{st.label}</span>
                    <span className="sr-only">{st.done ? "(done)" : "(to do)"}</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        );
      })()}

      {/* Section nav */}
      <nav
        aria-label="Sections"
        className="sticky top-0 z-10 -mx-4 mt-4 flex gap-1 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-pill sm:px-1.5 sm:shadow-card"
      >
        {SECTIONS.map((section) => {
          const needsAttention =
            (section.id === "images" && (product.media?.length ?? 0) === 0) ||
            (section.id === "variants" && product.variants.length === 0);
          const isActive = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={isActive ? "location" : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? "bg-ink text-white" : "text-ink hover:bg-surface"
              }`}
            >
              <SectionIcon id={section.id} />
              {section.label}
              {needsAttention && (
                <span aria-label="needs attention" className="size-1.5 rounded-full bg-amber-500" />
              )}
            </a>
          );
        })}
      </nav>

      <div aria-live="polite">
        {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && !error && <p className="mt-3 text-sm font-semibold text-green-700">✓ {notice}</p>}
      </div>

      {/* Basic information */}
      <Section
        id="basic"
        title="Basic information"
        description="Names and descriptions customers read, in both languages."
        action={
          !isEditingDetails && (
            <button type="button" onClick={startEditingDetails} className={`${secondaryButtonClass} py-1.5`}>
              Edit
            </button>
          )
        }
      >
        {!isEditingDetails ? (
          <div className="grid gap-3 md:grid-cols-2">
            <LanguageCard label="English">
              <p className="text-lg font-semibold text-ink">{product.nameEn}</p>
              <p className={`mt-1 text-sm whitespace-pre-line ${product.descriptionEn ? "text-ink/80" : "text-muted-foreground"}`}>
                {product.descriptionEn || "No description yet."}
              </p>
            </LanguageCard>
            <LanguageCard label="عربي" rtl>
              <p className="text-lg font-semibold text-ink">{product.nameAr}</p>
              <p className={`mt-1 text-sm whitespace-pre-line ${product.descriptionAr ? "text-ink/80" : "text-muted-foreground"}`}>
                {product.descriptionAr || "لا يوجد وصف بعد."}
              </p>
            </LanguageCard>
            <div className="rounded-2xl bg-background p-4 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Web address</p>
              <p className="mt-1 break-all text-ink">/products/{product.slug}</p>
            </div>
            <div className="rounded-2xl bg-background p-4 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Internal notes · staff only</p>
              <p className={`mt-1 whitespace-pre-line ${product.internalNotes ? "text-ink" : "text-muted-foreground"}`}>
                {product.internalNotes || "None"}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveDetails} className="grid gap-3 md:grid-cols-2">
            <LanguageCard label="English">
              <div className="flex flex-col gap-3">
                <Field label="Name">
                  <input required value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} className={`${inputClass} font-normal`} />
                </Field>
                <Field label="Description">
                  <textarea
                    rows={4}
                    value={editDescriptionEn}
                    onChange={(e) => setEditDescriptionEn(e.target.value)}
                    className={`${inputClass} rounded-2xl font-normal`}
                  />
                </Field>
              </div>
            </LanguageCard>
            <LanguageCard label="عربي" rtl>
              <div className="flex flex-col gap-3">
                <Field label="الاسم">
                  <input
                    required
                    dir="rtl"
                    value={editNameAr}
                    onChange={(e) => setEditNameAr(e.target.value)}
                    className={`${inputClass} font-normal`}
                  />
                </Field>
                <Field label="الوصف">
                  <textarea
                    rows={4}
                    dir="rtl"
                    value={editDescriptionAr}
                    onChange={(e) => setEditDescriptionAr(e.target.value)}
                    className={`${inputClass} rounded-2xl font-normal`}
                  />
                </Field>
              </div>
            </LanguageCard>
            <div className="rounded-2xl bg-background p-4 md:col-span-2">
              <Field label="Internal notes · staff only">
                <textarea
                  rows={2}
                  value={editInternalNotes}
                  onChange={(e) => setEditInternalNotes(e.target.value)}
                  className={`${inputClass} rounded-2xl font-normal`}
                />
              </Field>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" disabled={isSavingDetails} className={buttonClass}>
                {isSavingDetails ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={() => setIsEditingDetails(false)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-ink">Collections</h3>
          <p className="text-xs text-muted-foreground">Where customers find this design. It can be in several.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {product.collections.map((collection) => (
              <span
                key={collection.id}
                className="flex items-center gap-1 rounded-pill bg-ink py-1 ps-3 pe-1 text-sm font-semibold text-white"
              >
                <Link href={`/admin/catalog/collections/${collection.id}`} className="hover:underline">
                  {collection.nameEn}
                </Link>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDetachCollection(collection.id)}
                  aria-label={`Remove from ${collection.nameEn}`}
                  title="Remove from this collection"
                  className="flex size-6 items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
            {product.collections.length === 0 && (
              <span className="text-sm text-amber-700">Not in any collection yet.</span>
            )}
            {availableCollectionsToAttach.length > 0 && (
              <form onSubmit={handleAttachCollection} className="flex items-center gap-1.5">
                <select
                  aria-label="Add to collection"
                  value={attachCollectionId}
                  onChange={(e) => setAttachCollectionId(e.target.value)}
                  className={`${inputClass} py-1.5`}
                >
                  <option value="">+ Add to collection…</option>
                  {availableCollectionsToAttach.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
                {attachCollectionId && (
                  <button type="submit" disabled={isBusy} className={`${buttonClass} py-1.5`}>
                    Add
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
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
          <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            No variants yet — customers can&apos;t buy this design until you add some. The form below is already set
            to every phone model and case type; set a price and create them.
          </p>
        ) : (
          <>
            {/* Filters & bulk actions */}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground">
                  <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
                </svg>
                <input
                  type="search"
                  aria-label="Search variants"
                  placeholder="Search model or SKU"
                  value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)}
                  className={`w-full ${inputClass} ps-10`}
                />
              </div>
              <select
                aria-label="Brand"
                value={variantFilterBrand}
                onChange={(e) => setVariantFilterBrand(e.target.value)}
                className={`${inputClass} ${variantFilterBrand !== "ALL" ? "border-ink font-semibold" : ""}`}
              >
                <option value="ALL">All brands</option>
                {phoneBrands.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Case type"
                value={variantFilterCaseType}
                onChange={(e) => setVariantFilterCaseType(e.target.value)}
                className={`${inputClass} ${variantFilterCaseType !== "ALL" ? "border-ink font-semibold" : ""}`}
              >
                <option value="ALL">All case types</option>
                {caseTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="ms-auto flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy || product.variants.every((v) => v.isActive)}
                  onClick={() => handleBulkSetVariantsActive(true)}
                  className="rounded-pill px-3 py-1.5 text-xs font-semibold text-ink hover:bg-background disabled:opacity-40"
                >
                  Turn all on
                </button>
                <button
                  type="button"
                  disabled={isBusy || product.variants.every((v) => !v.isActive)}
                  onClick={() => handleBulkSetVariantsActive(false)}
                  className="rounded-pill px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-background hover:text-ink disabled:opacity-40"
                >
                  Turn all off
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] bg-background text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-start font-semibold">Phone model</th>
                      <th className="px-3 py-2.5 text-start font-semibold">SKU</th>
                      <th className="px-3 py-2.5 text-end font-semibold">Price</th>
                      <th className="px-3 py-2.5 text-center font-semibold">On</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVariants.map((variant) => {
                      const model = phoneModels.find((m) => m.id === variant.phoneModelId);
                      const caseType = caseTypes.find((c) => c.id === variant.caseTypeId);
                      const isEditing = editingVariantId === variant.id;
                      return (
                        <Fragment key={variant.id}>
                          <tr className={`border-t border-border ${isEditing ? "bg-background" : "hover:bg-background/60"} ${variant.isActive ? "" : "text-muted-foreground"}`}>
                            <td className="px-4 py-2.5">
                              <span className={`block font-semibold ${variant.isActive ? "text-ink" : ""}`}>
                                {model ? `${model.brand.name} ${model.name}` : "Accessory"}
                              </span>
                              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                {caseType?.name ?? "No case type"}
                                {variant.isPersonalizable && (
                                  <span className="rounded-full bg-accent-wash px-1.5 py-px text-[11px] font-semibold text-ink">
                                    Custom image +{formatPrice(variant.customizationPrice ?? 0, variant.currency)}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{variant.sku}</td>
                            <td className="px-3 py-2.5 text-end whitespace-nowrap tabular-nums">
                              <span className={variant.compareAtPrice !== null ? "font-semibold text-accent" : "font-semibold"}>
                                {formatPrice(variant.price, variant.currency)}
                              </span>
                              {variant.compareAtPrice !== null && (
                                <s className="ms-1.5 text-xs text-muted-foreground">
                                  {formatPrice(variant.compareAtPrice, variant.currency)}
                                </s>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <Switch
                                checked={variant.isActive}
                                disabled={isBusy}
                                onChange={(checked) => handleToggleVariantActive(variant.id, checked)}
                                label={`${variantLabel(variant)} active`}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-end">
                              <button
                                type="button"
                                onClick={() => (isEditing ? setEditingVariantId(null) : startEditingVariant(variant))}
                                className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
                                  isEditing ? "bg-ink text-white" : "border border-border bg-background text-ink hover:border-ink"
                                }`}
                              >
                                {isEditing ? "Close" : "Edit"}
                              </button>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr className="bg-background">
                              <td colSpan={5} className="px-4 pb-4">
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
                      );
                    })}
                    {filteredVariants.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No variants match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground">
                Showing {filteredVariants.length} of {product.variants.length} · {product.variants.filter((v) => v.isActive).length} on
              </p>
            </div>
          </>
        )}

        <div className={product.variants.length > 0 ? "mt-6 border-t border-border pt-5" : ""}>
          <h3 className="text-sm font-semibold text-ink">Add variants</h3>
          <p className="text-xs text-muted-foreground">
            Combinations that already exist are skipped, so you can safely run it again after adding new phone models.
          </p>
        </div>
        <div className="mt-3">
          <AddVariantPanel
            form={newVariant}
            setForm={setNewVariant}
            phoneModels={phoneModels}
            phoneBrands={phoneBrands}
            caseTypes={caseTypes}
            stockItems={stockItems}
            productSlug={product.slug}
            currency={product.currency}
            modelScope={modelScope}
            setModelScope={setModelScope}
            scopeBrandSlugs={scopeBrandSlugs}
            setScopeBrandSlugs={setScopeBrandSlugs}
            scopeCaseTypeIds={scopeCaseTypeIds}
            setScopeCaseTypeIds={setScopeCaseTypeIds}
            pendingCombosCount={pendingCombos.length}
            totalCombosCount={totalCombosCount}
            skippedCombosCount={skippedCombosCount}
            targetModelsCount={targetModels.filter(Boolean).length}
            targetCaseTypesCount={targetCaseTypes.filter(Boolean).length}
            bulkProgress={bulkProgress}
            onSubmit={handleAddVariant}
            disabled={isBusy}
          />
        </div>
      </Section>

      {/* Personalization */}
      <Section
        id="personalization"
        title="Personalization"
        description="Ways customers can make this case their own."
      >
        {(() => {
          const personalizable = product.variants.filter((v) => v.isPersonalizable).length;
          return (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">Customer&apos;s own image</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      personalizable ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground"
                    }`}
                  >
                    {personalizable ? `On for ${personalizable} of ${product.variants.length}` : "Off"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {personalizable ? (
                    <>
                      Customers upload a photo on the{" "}
                      <Link
                        href={`/customize?product=${product.slug}`}
                        target="_blank"
                        className="font-semibold text-accent underline underline-offset-4"
                      >
                        Design your case ↗
                      </Link>{" "}
                      page.
                    </>
                  ) : (
                    <>Turn it on per variant: click Edit on a variant above and tick &quot;Customer can upload their own image&quot;.</>
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">Personal note</p>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Always on</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Customers can add a note when they add it to the bag, like a name to print. You&apos;ll see it on the
                  order in{" "}
                  <Link href="/admin/orders" className="font-semibold text-accent underline underline-offset-4">
                    Orders
                  </Link>
                  .
                </p>
              </div>
            </div>
          );
        })()}
      </Section>

      {/* Inventory */}
      <Section
        id="inventory"
        title="Inventory"
        description="Change a variant's stock item with Edit under Variants. Adjust counts on the Stock page."
        action={
          <Link href="/admin/stock" className={`${secondaryButtonClass} py-1.5`}>
            Stock page
          </Link>
        }
      >
        {product.variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variants yet.</p>
        ) : (
          (() => {
            const rows = product.variants.map((variant) => {
              const stockItem = stockItems.find((st) => st.id === variant.stockItemId) ?? variant.stockItem;
              const available = stockItem ? stockItem.onHand - stockItem.reserved : null;
              const state: "made" | "none" | "out" | "in" = variant.isUnlimitedStock
                ? "made"
                : available === null
                  ? "none"
                  : available <= 0
                    ? "out"
                    : "in";
              return { variant, available, state };
            });
            const tiles = [
              { state: "made", label: "Made to order", tone: "bg-blue-100 text-blue-800" },
              { state: "in", label: "In stock", tone: "bg-green-100 text-green-800" },
              { state: "out", label: "Out of stock", tone: "bg-red-100 text-red-800" },
              { state: "none", label: "No stock item", tone: "bg-amber-100 text-amber-800" },
            ] as const;
            const problems = rows.filter((r) => r.state === "out" || r.state === "none");
            return (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {tiles.map((tile) => {
                    const count = rows.filter((r) => r.state === tile.state).length;
                    return (
                      <div key={tile.state} className="rounded-2xl bg-background p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <span aria-hidden className={`size-2 rounded-full ${tile.tone.split(" ")[0]}`} />
                          {tile.label}
                        </p>
                        <p className={`mt-1 font-display text-2xl ${count && (tile.state === "out" || tile.state === "none") ? "text-red-700" : "text-ink"}`}>
                          {count}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {problems.length > 0 && (
                  <>
                    <p className="mt-4 text-sm font-semibold text-ink">Needs attention</p>
                    <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
                      {problems.map(({ variant, state }) => (
                        <li key={variant.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                          <span className="min-w-0 truncate text-ink">{variantLabel(variant)}</span>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              state === "out" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {state === "out" ? "Out of stock" : "No stock item"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {rows.some((r) => r.state === "in") && (
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer font-semibold text-ink">
                      Stock per variant ({rows.filter((r) => r.state === "in").length})
                    </summary>
                    <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
                      {rows
                        .filter((r) => r.state === "in")
                        .map(({ variant, available }) => (
                          <li key={variant.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <span className="min-w-0 truncate text-ink">{variantLabel(variant)}</span>
                            <span className="shrink-0 font-semibold text-green-800 tabular-nums">{available} left</span>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()
        )}
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** Optional control on the right of the header (e.g. an Edit button). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="mt-4 scroll-mt-16 rounded-card bg-surface shadow-card"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-6">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-ink">
          <SectionIcon id={id as SectionId} className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-heading`} className="text-lg leading-tight font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
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

/** One language's block; Arabic content is laid out right-to-left. */
function LanguageCard({ label, rtl, children }: { label: string; rtl?: boolean; children: React.ReactNode }) {
  return (
    <div dir={rtl ? "rtl" : undefined} className="rounded-2xl bg-background p-4 text-start">
      <p className="mb-2 inline-block rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {label}
      </p>
      {children}
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
  const [allWas, setAllWas] = useState<number | null>(null);

  // Bulk by case type
  const [targetCaseTypeId, setTargetCaseTypeId] = useState("");
  const [caseTypePrice, setCaseTypePrice] = useState<number | null>(null);
  const [caseTypeWas, setCaseTypeWas] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState<"all" | "caseType">("all");
  const [showEach, setShowEach] = useState(false);

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
  const isWasInvalid = (d: { price: number | null; compareAtPrice: number | null }) =>
    d.price !== null && d.compareAtPrice !== null && d.compareAtPrice <= d.price;
  const hasInvalidWas = variants.some((v) => isWasInvalid(draft[v.id]));
  const allWasInvalid = allPrice !== null && allWas !== null && allWas <= allPrice;
  const onSaleCount = variants.filter((v) => draft[v.id].compareAtPrice !== null).length;

  const caseTypeWasInvalid = caseTypePrice !== null && caseTypeWas !== null && caseTypeWas <= caseTypePrice;
  // Current prices at a glance: one shared price, or a range.
  const prices = variants.map((v) => draft[v.id].price).filter((p): p is number => p !== null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const sharedWas = new Set(variants.map((v) => draft[v.id].compareAtPrice));
  const caseTypesInUse = (caseTypes ?? []).filter((c) => variants.some((v) => v.caseTypeId === c.id));

  function applyDraft(match: (v: AdminVariant) => boolean, price: number | null, was: number | null) {
    setDraft((prev) => {
      const next = { ...prev };
      for (const v of variants) if (match(v)) next[v.id] = { price, compareAtPrice: was };
      return next;
    });
    setInputsVersion((n) => n + 1);
  }

  const matchedCaseTypeCount = targetCaseTypeId
    ? variants.filter((v) => v.caseTypeId === targetCaseTypeId).length
    : 0;

  return (
    <div>
      {/* At a glance */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-background p-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {minPrice === maxPrice ? `All ${variants.length} variants` : `${variants.length} variants`}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-3xl text-ink">
              {minPrice === null
                ? "—"
                : minPrice === maxPrice
                  ? formatPrice(minPrice, currency)
                  : `${formatPrice(minPrice, currency)} – ${formatPrice(maxPrice!, currency)}`}
            </span>
            {onSaleCount > 0 && sharedWas.size === 1 && [...sharedWas][0] !== null && (
              <s className="text-sm text-muted-foreground">{formatPrice([...sharedWas][0]!, currency)}</s>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            onSaleCount > 0 ? "bg-accent text-white" : "bg-surface text-muted-foreground"
          }`}
        >
          {onSaleCount === 0 ? "Not on sale" : onSaleCount === variants.length ? "On sale" : `${onSaleCount} on sale`}
        </span>
      </div>

      {/* Bulk tools */}
      {variants.length > 1 && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Change prices in bulk</p>
            {caseTypesInUse.length > 1 && (
              <div role="radiogroup" aria-label="Apply to" className="inline-flex gap-0.5 rounded-pill bg-background p-0.5">
                {(
                  [
                    ["all", "All variants"],
                    ["caseType", "One case type"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={bulkMode === value}
                    onClick={() => setBulkMode(value)}
                    className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
                      bulkMode === value ? "bg-ink text-white" : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {bulkMode === "all" || caseTypesInUse.length <= 1 ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <MoneyInput label="Selling price" minorUnits={allPrice} onChange={setAllPrice} className="w-36" />
              <MoneyInput label="Old price — optional" minorUnits={allWas} onChange={setAllWas} className="w-36" />
              <button
                type="button"
                disabled={disabled || allPrice === null || allWasInvalid}
                onClick={() => applyDraft(() => true, allPrice, allWas)}
                className={secondaryButtonClass}
              >
                {allWas !== null ? `Put all ${variants.length} on sale` : `Apply to all ${variants.length}`}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                Case type
                <select
                  value={targetCaseTypeId}
                  onChange={(e) => setTargetCaseTypeId(e.target.value)}
                  className={`w-44 ${inputClass} font-normal`}
                >
                  <option value="">Choose…</option>
                  {caseTypesInUse.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({variants.filter((v) => v.caseTypeId === c.id).length})
                    </option>
                  ))}
                </select>
              </label>
              <MoneyInput label="Selling price" minorUnits={caseTypePrice} onChange={setCaseTypePrice} className="w-36" />
              <MoneyInput label="Old price — optional" minorUnits={caseTypeWas} onChange={setCaseTypeWas} className="w-36" />
              <button
                type="button"
                disabled={disabled || !targetCaseTypeId || caseTypePrice === null || matchedCaseTypeCount === 0 || caseTypeWasInvalid}
                onClick={() => applyDraft((v) => v.caseTypeId === targetCaseTypeId, caseTypePrice, caseTypeWas)}
                className={secondaryButtonClass}
              >
                Apply to {matchedCaseTypeCount} {matchedCaseTypeCount === 1 ? "variant" : "variants"}
              </button>
            </div>
          )}
          {(allWasInvalid || caseTypeWasInvalid) && (
            <p className="mt-2 text-xs font-semibold text-red-700">The old price must be higher than the selling price.</p>
          )}
          {onSaleCount > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setDraft((prev) =>
                  Object.fromEntries(
                    Object.entries(prev).map(([vid, d]) => [
                      vid,
                      d.compareAtPrice !== null ? { price: d.compareAtPrice, compareAtPrice: null } : d,
                    ]),
                  ),
                );
                setInputsVersion((n) => n + 1);
              }}
              className="mt-3 text-sm font-semibold text-accent hover:underline disabled:opacity-50"
              title="Each variant goes back to its old price and the crossed-out price disappears."
            >
              End sale on {onSaleCount} {onSaleCount === 1 ? "variant" : "variants"} →
            </button>
          )}
        </div>
      )}

      {/* One by one */}
      <div className="mt-4">
        {variants.length > 1 && (
          <button
            type="button"
            aria-expanded={showEach || changes.length > 0}
            onClick={() => setShowEach((open) => !open)}
            className="flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-accent"
          >
            <span aria-hidden className={`inline-block transition-transform ${showEach || changes.length > 0 ? "rotate-90" : ""}`}>
              ›
            </span>
            Edit each variant&apos;s price
            <span className="font-normal text-muted-foreground">({variants.length})</span>
          </button>
        )}
        {(variants.length === 1 || showEach || changes.length > 0) && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {variants.map((variant) => {
              const d = draft[variant.id];
              const changed = d.price !== variant.price || d.compareAtPrice !== variant.compareAtPrice;
              return (
                <li
                  key={`${variant.id}-${inputsVersion}`}
                  className={`flex flex-wrap items-end gap-3 px-4 py-3 ${changed ? "bg-amber-50" : ""}`}
                >
                  <div className="min-w-40 flex-1 self-center">
                    <p className="font-semibold text-ink">{labelFor(variant)}</p>
                    <p className="text-xs text-muted-foreground">
                      Now {formatPrice(variant.price, currency)}
                      {variant.compareAtPrice !== null && <> · was <s>{formatPrice(variant.compareAtPrice, currency)}</s></>}
                      {!variant.isActive && " · off"}
                    </p>
                  </div>
                  <MoneyInput
                    label="Price"
                    minorUnits={d.price}
                    onChange={(v) => setDraft((prev) => ({ ...prev, [variant.id]: { ...prev[variant.id], price: v } }))}
                    className="w-32"
                  />
                  <MoneyInput
                    label="Old price"
                    minorUnits={d.compareAtPrice}
                    onChange={(v) =>
                      setDraft((prev) => ({ ...prev, [variant.id]: { ...prev[variant.id], compareAtPrice: v } }))
                    }
                    className="w-32"
                  />
                  {isWasInvalid(d) && (
                    <p className="w-full text-xs font-semibold text-red-700">Old price must be higher than the price.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Save bar: only when something changed */}
      {(changes.length > 0 || hasEmpty || hasInvalidWas) && (
        <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-3 text-sm text-white shadow-lg">
          <span className="flex-1">
            {hasEmpty
              ? "Every variant needs a price."
              : hasInvalidWas
                ? "Fix the old prices marked in red."
                : `${changes.length} unsaved ${changes.length === 1 ? "price" : "prices"}`}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft(
                Object.fromEntries(variants.map((v) => [v.id, { price: v.price as number | null, compareAtPrice: v.compareAtPrice }])),
              );
              setInputsVersion((n) => n + 1);
            }}
            className="rounded-pill px-3 py-1.5 font-semibold text-white/80 hover:text-white"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={disabled || changes.length === 0 || hasEmpty || hasInvalidWas}
            onClick={() => onSave(changes)}
            className="rounded-pill bg-white px-4 py-1.5 font-semibold text-ink transition-colors enabled:hover:bg-accent enabled:hover:text-white disabled:opacity-50"
          >
            Save {changes.length > 1 ? `${changes.length} prices` : "price"}
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        The old price shows crossed out next to the selling price on the product page and product cards.
      </p>
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
        label="Old price — optional"
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
  currency,
  modelScope,
  setModelScope,
  scopeBrandSlugs,
  setScopeBrandSlugs,
  scopeCaseTypeIds,
  setScopeCaseTypeIds,
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
  currency: string;
  modelScope: ModelScope;
  setModelScope: (scope: ModelScope) => void;
  scopeBrandSlugs: string[];
  setScopeBrandSlugs: (slugs: string[]) => void;
  scopeCaseTypeIds: string[] | null;
  setScopeCaseTypeIds: (ids: string[] | null) => void;
  pendingCombosCount: number;
  totalCombosCount: number;
  skippedCombosCount: number;
  targetModelsCount: number;
  targetCaseTypesCount: number;
  bulkProgress: { current: number; total: number } | null;
  onSubmit: (event: React.FormEvent) => void;
  disabled: boolean;
}) {
  const allCaseTypesOn = scopeCaseTypeIds === null;
  const isCaseTypeOn = (id: string) => allCaseTypesOn || scopeCaseTypeIds.includes(id);

  function toggleCaseType(id: string) {
    const current = scopeCaseTypeIds ?? caseTypes.map((c) => c.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setScopeCaseTypeIds(next.length === caseTypes.length ? null : next);
  }

  function toggleBrand(slug: string) {
    setScopeBrandSlugs(
      scopeBrandSlugs.includes(slug) ? scopeBrandSlugs.filter((x) => x !== slug) : [...scopeBrandSlugs, slug],
    );
  }

  const wasInvalid = form.price !== null && form.compareAtPrice !== null && form.compareAtPrice <= form.price;
  const discountPercent =
    form.price !== null && form.compareAtPrice !== null && !wasInvalid
      ? Math.round(((form.compareAtPrice - form.price) / form.compareAtPrice) * 100)
      : null;
  const nothingPicked = modelScope === "brands" && scopeBrandSlugs.length === 0;

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex flex-col divide-y divide-border">
        {/* 1. Phone models */}
        <PanelStep n={1} title="Phone models" summary={modelScope === "one" ? undefined : `${targetModelsCount} selected`}>
          <Segmented
            value={modelScope}
            onChange={setModelScope}
            disabled={disabled}
            options={[
              { value: "all", label: `All models (${phoneModels.length})` },
              { value: "brands", label: "Pick brands" },
              { value: "one", label: "One model" },
            ]}
          />
          {modelScope === "brands" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {phoneBrands.map((brand) => (
                <Chip
                  key={brand.slug}
                  on={scopeBrandSlugs.includes(brand.slug)}
                  disabled={disabled}
                  onClick={() => toggleBrand(brand.slug)}
                >
                  {brand.name}
                  <span className="opacity-60">{phoneModels.filter((m) => m.brand.slug === brand.slug).length}</span>
                </Chip>
              ))}
            </div>
          )}
          {modelScope === "one" && (
            <select
              aria-label="Phone model"
              value={form.phoneModelId}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, phoneModelId: e.target.value }))}
              className={`mt-3 w-full max-w-xs ${inputClass}`}
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
          )}
        </PanelStep>

        {/* 2. Case types */}
        <PanelStep n={2} title="Case types" summary={`${targetCaseTypesCount} selected`}>
          <div className="flex flex-wrap gap-2">
            <Chip
              on={allCaseTypesOn}
              disabled={disabled}
              onClick={() => setScopeCaseTypeIds(allCaseTypesOn ? [] : null)}
            >
              All case types
            </Chip>
            <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
            {caseTypes.map((caseType) => (
              <Chip
                key={caseType.id}
                on={isCaseTypeOn(caseType.id)}
                disabled={disabled}
                onClick={() => toggleCaseType(caseType.id)}
              >
                {caseType.name}
              </Chip>
            ))}
          </div>
          {targetCaseTypesCount === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">None picked — variants get no case type.</p>
          )}
        </PanelStep>

        {/* 3. Price */}
        <PanelStep n={3} title="Price">
          <div className="flex flex-wrap items-end gap-3">
            <MoneyInput
              label="Selling price"
              minorUnits={form.price}
              onChange={(v) => setForm((f) => ({ ...f, price: v }))}
              className="w-40"
            />
            <MoneyInput
              label="Old price — optional"
              minorUnits={form.compareAtPrice}
              onChange={(v) => setForm((f) => ({ ...f, compareAtPrice: v }))}
              className="w-40"
            />
            <PricePreview price={form.price} was={form.compareAtPrice} currency={currency} />
          </div>
          <p className={`mt-2 text-xs ${wasInvalid ? "font-semibold text-red-700" : "text-muted-foreground"}`}>
            {wasInvalid
              ? "The old price must be higher than the selling price."
              : discountPercent !== null
                ? `On sale: customers see the old price crossed out (${discountPercent}% off).`
                : "Fill in an old price to show this as a sale — e.g. old 250, selling 199."}
          </p>
        </PanelStep>

        {/* More options */}
        <details className="group px-4 py-3 sm:px-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
            <span className="inline-block transition-transform group-open:rotate-90">›</span> More options
            <span className="ms-2 font-normal text-muted-foreground">
              {[
                form.isUnlimitedStock ? "made to order" : "tracked stock",
                form.isPersonalizable ? "custom image on" : null,
                form.isActive ? null : "inactive",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </summary>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
            <Field label="SKU prefix (optional)">
              <input
                placeholder={productSlug.toUpperCase()}
                value={form.sku}
                disabled={disabled}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className={`w-48 ${inputClass}`}
              />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isUnlimitedStock}
                disabled={disabled}
                onChange={(e) => setForm((f) => ({ ...f, isUnlimitedStock: e.target.checked, stockItemId: "" }))}
                className="size-4 accent-accent"
              />
              Unlimited stock (made to order)
            </label>
            {!form.isUnlimitedStock && (
              <Field label="Stock item">
                <select
                  value={form.stockItemId}
                  disabled={disabled}
                  onChange={(e) => setForm((f) => ({ ...f, stockItemId: e.target.value }))}
                  className={`w-48 ${inputClass}`}
                >
                  <option value="">No stock item</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} ({item.onHand - item.reserved} available)
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <label className="flex items-center gap-2 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isPersonalizable}
                disabled={disabled}
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
            <label className="flex items-center gap-2 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isActive}
                disabled={disabled}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="size-4 accent-accent"
              />
              Active (visible in the shop)
            </label>
          </div>
        </details>
      </div>

      {/* Summary + submit */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 sm:px-5">
        <p className="text-sm text-ink">
          {nothingPicked ? (
            <span className="text-muted-foreground">Pick at least one brand.</span>
          ) : pendingCombosCount === 0 ? (
            <span className="text-muted-foreground">All {totalCombosCount} combinations already exist.</span>
          ) : (
            <>
              <strong>{pendingCombosCount}</strong> new {pendingCombosCount === 1 ? "variant" : "variants"}
              {skippedCombosCount > 0 && (
                <span className="text-muted-foreground"> · {skippedCombosCount} already exist, skipped</span>
              )}
            </>
          )}
        </p>
        {bulkProgress ? (
          <div className="flex items-center gap-3" role="status">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-ink tabular-nums">
              {bulkProgress.current}/{bulkProgress.total}
            </span>
          </div>
        ) : (
          <button
            type="submit"
            disabled={disabled || pendingCombosCount === 0 || nothingPicked || form.price === null || wasInvalid}
            className={buttonClass}
          >
            {pendingCombosCount > 1 ? `Create ${pendingCombosCount} variants` : "Add variant"}
          </button>
        )}
      </div>
    </form>
  );
}

function PanelStep({
  n,
  title,
  summary,
  children,
}: {
  n: number;
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="px-4 py-4 sm:px-5">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
          {n}
        </span>
        <span className="text-sm font-semibold text-ink">{title}</span>
        {summary && <span className="text-xs text-muted-foreground">· {summary}</span>}
      </div>
      {children}
    </fieldset>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-pill bg-surface p-1">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              on ? "bg-ink text-white" : "text-muted-foreground hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        on ? "border-ink bg-ink text-white" : "border-border bg-background text-ink hover:border-ink"
      }`}
    >
      {on && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}

/** What the shop will show for this price / old price pair. */
function PricePreview({ price, was, currency }: { price: number | null; was: number | null; currency: string }) {
  if (price === null) return null;
  const onSale = was !== null && was > price;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">Shop shows</span>
      <div className="flex h-[38px] items-center gap-2 rounded-pill bg-surface px-4">
        <span className="font-semibold text-ink">{formatPrice(price, currency)}</span>
        {onSale && (
          <>
            <s className="text-sm text-muted-foreground">{formatPrice(was, currency)}</s>
            <span className="rounded-pill bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
              −{Math.round(((was - price) / was) * 100)}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}
