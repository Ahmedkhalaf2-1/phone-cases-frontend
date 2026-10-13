"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format-price";
import { useCart } from "@/lib/cart/CartProvider";
import type { PhoneBrand, PublicVariant } from "@/lib/api/types";
import { Spinner } from "@/components/ui/Spinner";

export function VariantPicker({
  variants,
  bundleNote,
  onVariantChange,
}: {
  variants: PublicVariant[];
  /** Compact sentence about an active bundle this product is eligible for. */
  bundleNote?: string;
  /** Lets the parent page sync a gallery/thumbnail to the selected variant. */
  onVariantChange?: (variant: PublicVariant | undefined) => void;
}) {
  const modelId = useId();
  const brandId = useId();
  const caseTypeId = useId();
  const noteId = useId();
  const { addItem, error: cartError } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [itemNote, setItemNote] = useState("");
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");

  const models = useMemo(() => {
    const seen = new Map<string, PublicVariant["phoneModel"]>();
    for (const variant of variants) {
      if (variant.phoneModel) seen.set(variant.phoneModel.slug, variant.phoneModel);
    }
    return Array.from(seen.values());
  }, [variants]);

  // Accessories (e.g. cables, stands) have variants with no phoneModel at
  // all — null compatibility means "not modeled per-phone", not "fits
  // every phone". Skip the model/case-type pickers entirely for these
  // rather than rendering empty selects that can never match a variant.
  const isAccessory = models.length === 0;

  // Brands come from the same variant data (phoneModel.brand); no extra
  // request. The brand picker is a mobile-only filter for the model list.
  const brands = useMemo(() => {
    const seen = new Map<string, PhoneBrand>();
    for (const model of models) {
      if (model) seen.set(model.brand.slug, model.brand);
    }
    return Array.from(seen.values());
  }, [models]);
  const [selectedBrandSlug, setSelectedBrandSlug] = useState("");
  const modelsForBrand = selectedBrandSlug
    ? models.filter((model) => model?.brand.slug === selectedBrandSlug)
    : models;

  const allCaseTypes = useMemo(() => {
    const seen = new Map<string, PublicVariant["caseType"]>();
    for (const variant of variants) {
      if (variant.caseType) seen.set(variant.caseType.slug, variant.caseType);
    }
    return Array.from(seen.values());
  }, [variants]);

  const [selectedModelSlug, setSelectedModelSlug] = useState("");

  const caseTypesForModel = useMemo(() => {
    if (!selectedModelSlug) return [];
    const seen = new Map<string, PublicVariant["caseType"]>();
    for (const variant of variants) {
      if (variant.phoneModel?.slug === selectedModelSlug && variant.caseType) {
        seen.set(variant.caseType.slug, variant.caseType);
      }
    }
    return Array.from(seen.values());
  }, [variants, selectedModelSlug]);

  const [selectedCaseTypeSlug, setSelectedCaseTypeSlug] = useState("");

  const activeCaseTypeSlug = caseTypesForModel.some(
    (c) => c?.slug === selectedCaseTypeSlug,
  )
    ? selectedCaseTypeSlug
    : "";

  const isSelectionComplete =
    isAccessory ||
    (Boolean(selectedModelSlug) &&
      (caseTypesForModel.length === 0 || Boolean(activeCaseTypeSlug)));

  const selectedVariant = isAccessory
    ? variants[0]
    : isSelectionComplete
      ? variants.find(
          (variant) =>
            variant.phoneModel?.slug === selectedModelSlug &&
            (caseTypesForModel.length === 0 ||
              variant.caseType?.slug === activeCaseTypeSlug),
        )
      : undefined;

  const minPrice = useMemo(() => {
    if (variants.length === 0) return 0;
    return Math.min(...variants.map((v) => v.price));
  }, [variants]);

  const currency = variants[0]?.currency ?? "EGP";

  const canAddToCart = Boolean(
    isSelectionComplete && selectedVariant?.isAvailable && status !== "adding",
  );

  useEffect(() => {
    onVariantChange?.(selectedVariant);
    // onVariantChange is expected to be referentially stable (useCallback)
    // in callers; only re-run when the actual selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.id]);

  return (
    <div className="flex flex-col gap-5 max-sm:gap-3">
      {!isAccessory && brands.length > 1 && (
        <div className="flex flex-col gap-1.5 max-sm:order-1 max-sm:gap-1 sm:hidden">
          <label
            htmlFor={brandId}
            className="text-sm font-medium tracking-tight text-ink max-sm:text-[13px]"
          >
            Phone brand
          </label>
          <select
            id={brandId}
            value={selectedBrandSlug}
            onChange={(event) => {
              const brandSlug = event.target.value;
              setSelectedBrandSlug(brandSlug);
              // Drop a model/case type that no longer belongs to this brand.
              const stillValid = models.some(
                (model) =>
                  model?.slug === selectedModelSlug &&
                  (!brandSlug || model.brand.slug === brandSlug),
              );
              if (!stillValid) {
                setSelectedModelSlug("");
                setSelectedCaseTypeSlug("");
              }
            }}
            className="w-full rounded-pill border border-border bg-background px-4 py-2.5 text-base text-ink min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Select phone brand</option>
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isAccessory && (
        <div className="flex flex-col gap-1.5 max-sm:order-2 max-sm:gap-1">
          <label
            htmlFor={modelId}
            className="text-sm font-medium tracking-tight text-ink max-sm:text-[13px]"
          >
            Phone model
          </label>
          <select
            id={modelId}
            value={selectedModelSlug}
            onChange={(event) => {
              setSelectedModelSlug(event.target.value);
              setSelectedCaseTypeSlug("");
            }}
            className="w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2.5 text-sm text-ink max-sm:min-h-11 max-sm:max-w-none max-sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Select phone model</option>
            {modelsForBrand.map((model) =>
              model ? (
                <option key={model.slug} value={model.slug}>
                  {model.brand.name} {model.name}
                </option>
              ) : null,
            )}
          </select>
        </div>
      )}

      {!isAccessory && allCaseTypes.length > 0 && (
        <div className="flex flex-col gap-1.5 max-sm:order-3 max-sm:gap-1 max-sm:[&:has(select:disabled)_label]:text-muted-foreground">
          <label
            htmlFor={caseTypeId}
            className="text-sm font-medium tracking-tight text-ink max-sm:text-[13px]"
          >
            Case type
          </label>
          <select
            id={caseTypeId}
            disabled={!selectedModelSlug}
            value={activeCaseTypeSlug}
            onChange={(event) => setSelectedCaseTypeSlug(event.target.value)}
            className="w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2.5 text-sm text-ink max-sm:min-h-11 max-sm:max-w-none max-sm:text-base disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">
              {!selectedModelSlug
                ? "Select phone model first"
                : caseTypesForModel.length === 0
                ? "No case types available"
                : "Select case type"}
            </option>
            {caseTypesForModel.map((caseType) =>
              caseType ? (
                <option key={caseType.slug} value={caseType.slug}>
                  {caseType.name}
                </option>
              ) : null,
            )}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-sm:order-8 max-sm:gap-1.5">
        <label
          htmlFor={noteId}
          className="flex items-center justify-between text-sm font-medium tracking-tight text-ink max-w-xs max-sm:max-w-none max-sm:text-[13px] max-sm:font-normal max-sm:text-muted-foreground"
        >
          <span>Note / Instructions (optional)</span>
          <span className="text-xs font-normal text-muted-foreground max-sm:text-[11px]" dir="rtl">
            ملاحظات خاصة (اختياري)
          </span>
        </label>
        <textarea
          id={noteId}
          dir="auto"
          rows={2}
          maxLength={500}
          value={itemNote}
          onChange={(e) => setItemNote(e.target.value)}
          placeholder="e.g. Add name 'Ahmed' on the back / مثال: اكتب اسم أحمد على الجراب"
          className="w-full max-w-xs rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-ink placeholder:text-muted-foreground/70 max-sm:max-w-none max-sm:resize-none max-sm:py-2 max-sm:text-base max-sm:leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent resize-y"
        />
        <div className={`flex justify-end max-w-xs max-sm:max-w-none ${itemNote.length === 0 ? "max-sm:hidden" : ""}`}>
          <span className="text-[11px] text-muted-foreground">
            {itemNote.length} / 500
          </span>
        </div>
      </div>

      {selectedVariant ? (
        <div className="max-sm:order-4 max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-3 max-sm:gap-y-0.5">
          <p className="font-display text-3xl text-ink">
            {formatPrice(selectedVariant.price, selectedVariant.currency)}
          </p>
          {selectedVariant.compareAtPrice && (
            <p className="text-sm text-muted-foreground line-through">
              {formatPrice(
                selectedVariant.compareAtPrice,
                selectedVariant.currency,
              )}
            </p>
          )}
          <p
            className={`mt-1 text-sm font-semibold uppercase max-sm:mt-0 max-sm:text-xs max-sm:tracking-wide ${
              selectedVariant.isAvailable ? "text-green-700" : "text-accent"
            }`}
          >
            {selectedVariant.isAvailable ? "In stock" : "Out of stock"}
          </p>
        </div>
      ) : !isSelectionComplete ? (
        <div className="max-sm:order-4">
          <p className="font-display text-3xl text-ink">
            <span className="text-lg font-normal text-muted-foreground max-sm:text-sm max-sm:font-medium max-sm:tracking-wider max-sm:uppercase">From </span>
            {formatPrice(minPrice, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground max-sm:text-[13px] max-sm:leading-5">
            {!selectedModelSlug
              ? "Select your phone model to check availability and options."
              : "Select your case type to continue."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground max-sm:order-4">
          This combination isn&apos;t available. Try a different phone
          model or case type above.
        </p>
      )}

      {bundleNote && (
        <p className="rounded-xl bg-accent-wash px-3 py-2 text-[13px] leading-5 text-ink max-sm:order-5">
          {bundleNote}
        </p>
      )}

      <div className="flex flex-col gap-5 max-sm:order-6 max-sm:flex-row max-sm:items-stretch max-sm:gap-3">
      {selectedVariant?.isAvailable && (
        <div className="flex items-center gap-3 max-sm:shrink-0">
          <label htmlFor={`${modelId}-qty`} className="sr-only">
            Quantity
          </label>
          <div className="flex items-center rounded-pill border border-border max-sm:h-12">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="min-h-11 min-w-11 px-3 py-2 text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              −
            </button>
            <input
              id={`${modelId}-qty`}
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                )
              }
              className="w-12 border-x border-border bg-background py-2 text-center text-sm max-sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              aria-label="Increase quantity"
              className="min-h-11 min-w-11 px-3 py-2 text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              +
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!canAddToCart}
        onClick={async () => {
          if (!canAddToCart || !selectedVariant) return;
          setStatus("adding");
          try {
            await addItem(
              selectedVariant.id,
              quantity,
              itemNote.trim() || undefined,
            );
            setStatus("added");
          } catch {
            // cartError (from context) already carries the message; just
            // stop showing a spinner instead of also claiming success.
            setStatus("error");
          }
        }}
        title={
          !isAccessory && !selectedModelSlug
            ? "Please select a phone model first"
            : !isAccessory && !activeCaseTypeSlug && caseTypesForModel.length > 0
            ? "Please select a case type first"
            : selectedVariant && !selectedVariant.isAvailable
            ? "This combination is out of stock"
            : undefined
        }
        aria-busy={status === "adding"}
        className="inline-flex min-h-13 w-full max-w-xs items-center justify-center gap-2 max-sm:h-12 max-sm:min-h-0 max-sm:max-w-none max-sm:flex-1 rounded-pill bg-ink px-6 py-3.5 text-sm font-semibold tracking-tight text-white transition-[background-color,transform] duration-[var(--sf-dur-fast)] enabled:hover:bg-ink/85 enabled:active:scale-[0.98] enabled:active:bg-ink/95 motion-reduce:transform-none disabled:cursor-not-allowed disabled:bg-ink/40 aria-busy:disabled:cursor-progress aria-busy:disabled:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {status === "adding" && <Spinner />}
        {status === "adding"
          ? "Adding…"
          : !isAccessory && !selectedModelSlug
          ? "Select phone model"
          : !isAccessory && !activeCaseTypeSlug && caseTypesForModel.length > 0
          ? "Select case type"
          : selectedVariant && !selectedVariant.isAvailable
          ? "Out of stock"
          : "Add to cart"}
      </button>
      </div>

      {!isSelectionComplete && (
        <p className="text-xs text-muted-foreground max-sm:sr-only max-sm:order-7">
          {!selectedModelSlug
            ? "Please select your phone model to continue."
            : "Please select your case type to continue."}
        </p>
      )}

      {status === "added" && !cartError && (
        <p className="sf-message-in text-sm text-ink max-sm:order-7">
          Added to cart.{" "}
          <Link href="/cart" className="font-semibold underline underline-offset-4">
            View cart →
          </Link>
        </p>
      )}
      {cartError && <p className="text-sm text-accent max-sm:order-7">{cartError}</p>}
    </div>
  );
}
