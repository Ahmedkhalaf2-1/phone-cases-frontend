"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format-price";
import { useCart } from "@/lib/cart/CartProvider";
import type { PublicVariant } from "@/lib/api/types";

export function VariantPicker({
  variants,
  onVariantChange,
}: {
  variants: PublicVariant[];
  /** Lets the parent page sync a gallery/thumbnail to the selected variant. */
  onVariantChange?: (variant: PublicVariant | undefined) => void;
}) {
  const modelId = useId();
  const caseTypeId = useId();
  const { addItem, error: cartError } = useCart();
  const [quantity, setQuantity] = useState(1);
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
    <div className="flex flex-col gap-5">
      {!isAccessory && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={modelId}
            className="text-sm font-medium tracking-tight text-ink"
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
            className="w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Select phone model</option>
            {models.map((model) =>
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
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={caseTypeId}
            className="text-sm font-medium tracking-tight text-ink"
          >
            Case type
          </label>
          <select
            id={caseTypeId}
            disabled={!selectedModelSlug}
            value={activeCaseTypeSlug}
            onChange={(event) => setSelectedCaseTypeSlug(event.target.value)}
            className="w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

      {selectedVariant ? (
        <div>
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
            className={`mt-1 text-sm font-semibold uppercase ${
              selectedVariant.isAvailable ? "text-green-700" : "text-accent"
            }`}
          >
            {selectedVariant.isAvailable ? "In stock" : "Out of stock"}
          </p>
        </div>
      ) : !isSelectionComplete ? (
        <div>
          <p className="font-display text-3xl text-ink">
            <span className="text-lg font-normal text-muted-foreground">From </span>
            {formatPrice(minPrice, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {!selectedModelSlug
              ? "Select your phone model to check availability and options."
              : "Select your case type to continue."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This combination isn&apos;t available. Try a different phone
          model or case type above.
        </p>
      )}

      {selectedVariant?.isAvailable && (
        <div className="flex items-center gap-3">
          <label htmlFor={`${modelId}-qty`} className="sr-only">
            Quantity
          </label>
          <div className="flex items-center rounded-pill border border-border">
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
              className="w-12 border-x border-border bg-background py-2 text-center text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            await addItem(selectedVariant.id, quantity);
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
        className="inline-flex min-h-13 w-full max-w-xs items-center justify-center gap-2 rounded-pill bg-ink px-6 py-3.5 text-sm font-medium tracking-tight text-white transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink/40"
      >
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

      {!isSelectionComplete && (
        <p className="text-xs text-muted-foreground">
          {!selectedModelSlug
            ? "Please select your phone model to continue."
            : "Please select your case type to continue."}
        </p>
      )}

      {status === "added" && !cartError && (
        <p className="text-sm text-ink">
          Added to cart.{" "}
          <Link href="/cart" className="font-semibold underline underline-offset-4">
            View cart →
          </Link>
        </p>
      )}
      {cartError && <p className="text-sm text-accent">{cartError}</p>}
    </div>
  );
}
