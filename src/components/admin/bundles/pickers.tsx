"use client";

import { useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type {
  AdminCaseType,
  AdminCollection,
  AdminPhoneBrand,
  AdminPhoneModel,
  BundleEligibleVariant,
  BundleScope,
  BundleVariantInfo,
} from "@/lib/admin/types";
import {
  inputClass,
  linkButtonClass,
  secondaryButtonClass,
  useDebounced,
  useRemote,
  variantLabel,
} from "./bundle-utils";

/** Mirrors the backend's targetIds limit (ArrayMaxSize) so we never submit more. */
export const MAX_TARGETS = 500;
/** Mirrors the backend's MAX_SELECT_ALL_IDS for "select all N variants". */
const MAX_SELECT_ALL_VARIANTS = 1000;
const REVIEW_PAGE_SIZE = 25;

export type TargetSelection = Record<string, string>; // id -> display name
interface VariantSelection {
  surcharge: number | null;
  info?: NonNullable<BundleEligibleVariant["variant"]>;
}
export type VariantSelectionMap = Record<string, VariantSelection>;

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function PickerShell({
  children,
  selectedCount,
  noun,
  onClear,
}: {
  children: React.ReactNode;
  selectedCount: number;
  noun: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {children}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold text-ink" aria-live="polite">
          {selectedCount} {noun}
          {selectedCount === 1 ? "" : "s"} selected
        </p>
        {selectedCount > 0 && (
          <button type="button" onClick={onClear} className={linkButtonClass}>
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  totalItems,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {totalItems} result{totalItems === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={secondaryButtonClass}
        >
          Previous
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className={secondaryButtonClass}
        >
          Next
        </button>
      </div>
    </div>
  );
}

const rowClass =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors hover:border-border hover:bg-surface has-[:checked]:border-border has-[:checked]:bg-surface";

/* ------------------------------------------------------------------ */
/* Specific products (server-side search + pagination)                 */
/* ------------------------------------------------------------------ */

export function ProductPicker({
  selected,
  onChange,
}: {
  selected: TargetSelection;
  onChange: (next: TargetSelection) => void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [page, setPage] = useState(1);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const q = useDebounced(search.trim());

  const collections = useRemote("collections", () =>
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token)),
  );
  const products = useRemote(`products|${q}|${collectionId}|${page}`, () =>
    authorizedFetch((token) =>
      adminClient.listProducts(token, {
        q: q || undefined,
        collectionId: collectionId || undefined,
        page,
        pageSize: 20,
      }),
    ),
  );

  const items = products.data?.items ?? [];
  const meta = products.data?.meta;

  function toggle(id: string, name: string, checked: boolean) {
    const next = { ...selected };
    if (checked) next[id] = name;
    else delete next[id];
    onChange(next);
  }

  function selectPage() {
    const next = { ...selected };
    for (const product of items) next[product.id] = product.nameEn;
    onChange(next);
  }

  async function selectAllResults() {
    if (!meta) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const next = { ...selected };
      for (let pageNo = 1; pageNo <= Math.ceil(meta.totalItems / 100); pageNo++) {
        const result = await authorizedFetch((token) =>
          adminClient.listProducts(token, {
            q: q || undefined,
            collectionId: collectionId || undefined,
            page: pageNo,
            pageSize: 100,
          }),
        );
        for (const product of result.items) next[product.id] = product.nameEn;
      }
      if (Object.keys(next).length > MAX_TARGETS) {
        // Never apply a partial "select all" - leave the selection untouched.
        setBulkMessage(
          `That would select more than ${MAX_TARGETS} products, so nothing was changed. ` +
            "Filter by collection, or use the Collections scope to cover a whole range.",
        );
        return;
      }
      onChange(next);
    } catch (err) {
      setBulkMessage(errorText(err, "Could not select all results."));
    } finally {
      setBulkBusy(false);
    }
  }

  const tooManyProducts = (meta?.totalItems ?? 0) > MAX_TARGETS;

  return (
    <PickerShell
      selectedCount={Object.keys(selected).length}
      noun="product"
      onClear={() => onChange({})}
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search products…"
          aria-label="Search products"
          className={`${inputClass} min-w-48 flex-1`}
        />
        <select
          value={collectionId}
          onChange={(e) => {
            setCollectionId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by collection"
          className={inputClass}
        >
          <option value="">All collections</option>
          {(collections.data ?? []).map((c: AdminCollection) => (
            <option key={c.id} value={c.id}>
              {c.nameEn}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={selectPage}
          disabled={items.length === 0}
          className={linkButtonClass}
        >
          Select this page
        </button>
        <button
          type="button"
          onClick={selectAllResults}
          disabled={bulkBusy || !meta || meta.totalItems === 0 || tooManyProducts}
          className={linkButtonClass}
        >
          {bulkBusy ? "Selecting…" : `Select all ${meta?.totalItems ?? 0} results`}
        </button>
      </div>
      {tooManyProducts && (
        <p className="text-sm text-muted-foreground">
          {meta?.totalItems} products match — more than the {MAX_TARGETS} that can be
          picked individually. Narrow the search or filter by collection, or use the
          All products or Collections scope instead.
        </p>
      )}
      {bulkMessage && <p className="text-sm text-accent">{bulkMessage}</p>}

      <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
        {products.loading && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Loading products…</p>
        )}
        {products.error && <p className="px-3 py-2 text-sm text-accent">{products.error}</p>}
        {!products.loading && items.length === 0 && !products.error && (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No products match your search.
          </p>
        )}
        {items.map((product) => (
          <label key={product.id} className={rowClass}>
            <input
              type="checkbox"
              checked={product.id in selected}
              onChange={(e) => toggle(product.id, product.nameEn, e.target.checked)}
              className="mt-0.5 size-4 accent-accent"
            />
            <span className="flex-1">
              <span className="block font-semibold text-ink">{product.nameEn}</span>
              <span className="block text-xs text-muted-foreground">
                {product.variants.length} variant{product.variants.length === 1 ? "" : "s"} ·{" "}
                {product.status.toLowerCase()}
              </span>
            </span>
          </label>
        ))}
      </div>
      {meta && (
        <Pager
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={meta.totalItems}
          onPage={setPage}
        />
      )}
    </PickerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Collections / case types / phone brands / phone models              */
/* (small taxonomies: loaded once, filtered client-side)               */
/* ------------------------------------------------------------------ */

interface TaxonomyRow {
  id: string;
  name: string;
  hint?: string;
  groupId?: string;
}

export function TaxonomyPicker({
  scope,
  selected,
  onChange,
}: {
  scope: Extract<BundleScope, "COLLECTIONS" | "CASE_TYPES" | "PHONE_BRANDS" | "PHONE_MODELS">;
  selected: TargetSelection;
  onChange: (next: TargetSelection) => void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("");

  const rows = useRemote(`taxonomy|${scope}`, async (): Promise<TaxonomyRow[]> => {
    if (scope === "COLLECTIONS") {
      const list = await authorizedFetch((t) => adminClient.listCollectionsAdmin(t));
      return list.map((c: AdminCollection) => ({ id: c.id, name: c.nameEn }));
    }
    if (scope === "CASE_TYPES") {
      const list = await authorizedFetch((t) => adminClient.listCaseTypesAdmin(t));
      return list.map((c: AdminCaseType) => ({ id: c.id, name: c.nameEn }));
    }
    if (scope === "PHONE_BRANDS") {
      const list = await authorizedFetch((t) => adminClient.listPhoneBrands(t));
      return list.map((b: AdminPhoneBrand) => ({ id: b.id, name: b.nameEn }));
    }
    const list = await authorizedFetch((t) => adminClient.listPhoneModels(t));
    return list.map((m: AdminPhoneModel) => ({
      id: m.id,
      name: m.nameEn,
      hint: m.brand?.nameEn,
      groupId: m.brandId,
    }));
  });
  const brands = useRemote("taxonomy-brands", () =>
    scope === "PHONE_MODELS"
      ? authorizedFetch((t) => adminClient.listPhoneBrands(t))
      : Promise.resolve([] as AdminPhoneBrand[]),
  );

  const needle = search.trim().toLowerCase();
  const visible = (rows.data ?? []).filter(
    (row) =>
      (!brandId || row.groupId === brandId) &&
      (!needle || `${row.name} ${row.hint ?? ""}`.toLowerCase().includes(needle)),
  );
  const noun = {
    COLLECTIONS: "collection",
    CASE_TYPES: "case type",
    PHONE_BRANDS: "phone brand",
    PHONE_MODELS: "phone model",
  }[scope];

  function toggle(row: TaxonomyRow, checked: boolean) {
    const next = { ...selected };
    if (checked) next[row.id] = row.name;
    else delete next[row.id];
    onChange(next);
  }

  function selectVisible() {
    const next = { ...selected };
    for (const row of visible) next[row.id] = row.name;
    onChange(next);
  }

  return (
    <PickerShell
      selectedCount={Object.keys(selected).length}
      noun={noun}
      onClear={() => onChange({})}
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${noun}s…`}
          aria-label={`Search ${noun}s`}
          className={`${inputClass} min-w-48 flex-1`}
        />
        {scope === "PHONE_MODELS" && (
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            aria-label="Filter by phone brand"
            className={inputClass}
          >
            <option value="">All brands</option>
            {(brands.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nameEn}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        type="button"
        onClick={selectVisible}
        disabled={visible.length === 0}
        className={`${linkButtonClass} self-start`}
      >
        Select all {visible.length} shown
      </button>
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-2xl border border-border p-2">
        {rows.loading && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
        )}
        {rows.error && <p className="px-3 py-2 text-sm text-accent">{rows.error}</p>}
        {!rows.loading && visible.length === 0 && !rows.error && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Nothing matches.</p>
        )}
        {visible.map((row) => (
          <label key={row.id} className={rowClass}>
            <input
              type="checkbox"
              checked={row.id in selected}
              onChange={(e) => toggle(row, e.target.checked)}
              className="mt-0.5 size-4 accent-accent"
            />
            <span className="flex-1">
              <span className="font-semibold text-ink">{row.name}</span>
              {row.hint && (
                <span className="ms-2 text-xs text-muted-foreground">{row.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </PickerShell>
  );
}

/* ------------------------------------------------------------------ */
/* Specific variants (server-side search, filters, pagination)         */
/* ------------------------------------------------------------------ */

export function VariantPicker({
  selected,
  onChange,
}: {
  selected: VariantSelectionMap;
  onChange: (next: VariantSelectionMap) => void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [caseTypeId, setCaseTypeId] = useState("");
  const [phoneBrandId, setPhoneBrandId] = useState("");
  const [phoneModelId, setPhoneModelId] = useState("");
  const [page, setPage] = useState(1);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const q = useDebounced(search.trim());

  const filters = {
    q: q || undefined,
    collectionId: collectionId || undefined,
    caseTypeId: caseTypeId || undefined,
    phoneBrandId: phoneBrandId || undefined,
    phoneModelId: phoneModelId || undefined,
  };

  const taxonomy = useRemote("variant-taxonomy", async () => {
    const [collections, caseTypes, brands, models] = await Promise.all([
      authorizedFetch((t) => adminClient.listCollectionsAdmin(t)),
      authorizedFetch((t) => adminClient.listCaseTypesAdmin(t)),
      authorizedFetch((t) => adminClient.listPhoneBrands(t)),
      authorizedFetch((t) => adminClient.listPhoneModels(t)),
    ]);
    return { collections, caseTypes, brands, models };
  });
  const options = useRemote(`variants|${JSON.stringify(filters)}|${page}`, () =>
    authorizedFetch((token) =>
      adminClient.bundleVariantOptions(token, { ...filters, page, pageSize: 20 }),
    ),
  );

  const items = options.data?.items ?? [];
  const meta = options.data?.meta;
  const modelsForBrand = (taxonomy.data?.models ?? []).filter(
    (m) => !phoneBrandId || m.brandId === phoneBrandId,
  );

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function toggle(info: BundleVariantInfo, checked: boolean) {
    const next = { ...selected };
    if (checked) next[info.id] = { surcharge: selected[info.id]?.surcharge ?? null, info };
    else delete next[info.id];
    onChange(next);
  }

  function selectPage() {
    const next = { ...selected };
    for (const info of items) {
      next[info.id] = { surcharge: selected[info.id]?.surcharge ?? null, info };
    }
    onChange(next);
  }

  async function selectAllResults() {
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const result = await authorizedFetch((token) =>
        adminClient.bundleVariantOptionIds(token, filters),
      );
      const next = { ...selected };
      for (const id of result.ids) {
        next[id] = selected[id] ?? { surcharge: null };
      }
      onChange(next);
    } catch (err) {
      setBulkMessage(errorText(err, "Could not select all results."));
    } finally {
      setBulkBusy(false);
    }
  }

  const tooManyVariants = (meta?.totalItems ?? 0) > MAX_SELECT_ALL_VARIANTS;
  const selectedIds = Object.keys(selected);

  return (
    <PickerShell selectedCount={selectedIds.length} noun="variant" onClear={() => onChange({})}>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product, phone, case type or SKU…"
          aria-label="Search variants"
          className={`${inputClass} sm:col-span-2`}
        />
        <select
          value={collectionId}
          onChange={(e) => resetPage(setCollectionId)(e.target.value)}
          aria-label="Filter by collection"
          className={inputClass}
        >
          <option value="">All collections</option>
          {(taxonomy.data?.collections ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameEn}
            </option>
          ))}
        </select>
        <select
          value={caseTypeId}
          onChange={(e) => resetPage(setCaseTypeId)(e.target.value)}
          aria-label="Filter by case type"
          className={inputClass}
        >
          <option value="">All case types</option>
          {(taxonomy.data?.caseTypes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameEn}
            </option>
          ))}
        </select>
        <select
          value={phoneBrandId}
          onChange={(e) => {
            setPhoneBrandId(e.target.value);
            setPhoneModelId("");
            setPage(1);
          }}
          aria-label="Filter by phone brand"
          className={inputClass}
        >
          <option value="">All phone brands</option>
          {(taxonomy.data?.brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameEn}
            </option>
          ))}
        </select>
        <select
          value={phoneModelId}
          onChange={(e) => resetPage(setPhoneModelId)(e.target.value)}
          aria-label="Filter by phone model"
          className={inputClass}
        >
          <option value="">All phone models</option>
          {modelsForBrand.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nameEn}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={selectPage}
          disabled={items.length === 0}
          className={linkButtonClass}
        >
          Select this page
        </button>
        <button
          type="button"
          onClick={selectAllResults}
          disabled={bulkBusy || !meta || meta.totalItems === 0 || tooManyVariants}
          className={linkButtonClass}
        >
          {bulkBusy ? "Selecting…" : `Select all ${meta?.totalItems ?? 0} results`}
        </button>
      </div>
      {tooManyVariants && (
        <p className="text-sm text-muted-foreground">
          {meta?.totalItems} variants match — more than the {MAX_SELECT_ALL_VARIANTS} that can
          be selected at once. Narrow the filters, or use the All products, Collections,
          Case types, Phone brands or Phone models scope so new variants are included
          automatically.
        </p>
      )}
      {bulkMessage && <p className="text-sm text-accent">{bulkMessage}</p>}

      <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
        {options.loading && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Loading variants…</p>
        )}
        {options.error && <p className="px-3 py-2 text-sm text-accent">{options.error}</p>}
        {!options.loading && items.length === 0 && !options.error && (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No variants match these filters.
          </p>
        )}
        {items.map((info) => {
          const label = variantLabel(info);
          return (
            <label key={info.id} className={rowClass}>
              <input
                type="checkbox"
                checked={info.id in selected}
                onChange={(e) => toggle(info, e.target.checked)}
                className="mt-0.5 size-4 accent-accent"
              />
              <span className="grid flex-1 gap-0.5 sm:grid-cols-3 sm:gap-3">
                <span>
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    Product
                  </span>
                  <span className="block font-semibold text-ink">{label.product}</span>
                </span>
                <span>
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    Phone
                  </span>
                  <span className="block text-ink">{label.phone ?? "—"}</span>
                </span>
                <span>
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    Case
                  </span>
                  <span className="block text-ink">{label.caseType ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {info.sku} · {formatPrice(info.price, info.currency)}
                    {!info.isActive && " · inactive"}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {meta && (
        <Pager
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={meta.totalItems}
          onPage={setPage}
        />
      )}

      {selectedIds.length > 0 && (
        <SelectedVariantsReview
          selected={selected}
          selectedIds={selectedIds}
          onChange={onChange}
        />
      )}
    </PickerShell>
  );
}

/**
 * Paginated review of the current variant selection. Labels for ids that
 * arrived without details (e.g. via "Select all results") are fetched for
 * the visible page only, so every selected variant is always explainable.
 */
function SelectedVariantsReview({
  selected,
  selectedIds,
  onChange,
}: {
  selected: VariantSelectionMap;
  selectedIds: string[];
  onChange: (next: VariantSelectionMap) => void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(selectedIds.length / REVIEW_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageIds = selectedIds.slice(
    (safePage - 1) * REVIEW_PAGE_SIZE,
    safePage * REVIEW_PAGE_SIZE,
  );
  const missing = pageIds.filter((id) => !selected[id].info);

  const fetched = useRemote(`review|${missing.join(",")}`, () =>
    missing.length === 0
      ? Promise.resolve([] as BundleVariantInfo[])
      : authorizedFetch((token) => adminClient.bundleVariantsByIds(token, missing)),
  );
  const fetchedById = new Map((fetched.data ?? []).map((info) => [info.id, info]));

  return (
    <details className="rounded-2xl border border-border p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Review {selectedIds.length} selected &amp; set surcharges
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        A surcharge is added on top of the bundle price when that variant is one of
        the bundled items (e.g. a premium case).
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {pageIds.map((id) => {
          const entry = selected[id];
          const info = entry.info ?? fetchedById.get(id);
          const label = info ? variantLabel(info) : null;
          return (
            <div key={id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-0 flex-1">
                {label ? (
                  <>
                    <span className="font-semibold text-ink">{label.product}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {label.phone ?? "No phone"} · {label.caseType ?? "No case type"}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {fetched.loading ? "Loading details…" : "Variant details unavailable"}
                  </span>
                )}
              </span>
              <MoneyInput
                label="Surcharge"
                minorUnits={entry.surcharge}
                onChange={(value) =>
                  onChange({ ...selected, [id]: { ...entry, surcharge: value } })
                }
                className="w-24"
              />
              <button
                type="button"
                onClick={() => {
                  const next = { ...selected };
                  delete next[id];
                  onChange(next);
                }}
                className={linkButtonClass}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className={secondaryButtonClass}
          >
            Previous
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            className={secondaryButtonClass}
          >
            Next
          </button>
        </div>
      )}
    </details>
  );
}
