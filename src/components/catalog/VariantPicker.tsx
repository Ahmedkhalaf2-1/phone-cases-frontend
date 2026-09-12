"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format-price";
import { useCart } from "@/lib/cart/CartProvider";
import type { PublicVariant } from "@/lib/api/types";

export function VariantPicker({ variants }: { variants: PublicVariant[] }) {
  const modelId = useId();
  const caseTypeId = useId();
  const { addItem, error: cartError } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");

  const models = useMemo(() => {
    const seen = new Map<string, PublicVariant["phoneModel"]>();
    for (const variant of variants) {
      if (variant.phoneModel) seen.set(variant.phoneModel.slug, variant.phoneModel);
    }
    return Array.from(seen.values());
  }, [variants]);

  const [selectedModelSlug, setSelectedModelSlug] = useState(
    models[0]?.slug ?? "",
  );

  const caseTypesForModel = useMemo(() => {
    const seen = new Map<string, PublicVariant["caseType"]>();
    for (const variant of variants) {
      if (variant.phoneModel?.slug === selectedModelSlug && variant.caseType) {
        seen.set(variant.caseType.slug, variant.caseType);
      }
    }
    return Array.from(seen.values());
  }, [variants, selectedModelSlug]);

  const [selectedCaseTypeSlug, setSelectedCaseTypeSlug] = useState(
    caseTypesForModel[0]?.slug ?? "",
  );

  const activeCaseTypeSlug = caseTypesForModel.some(
    (c) => c?.slug === selectedCaseTypeSlug,
  )
    ? selectedCaseTypeSlug
    : (caseTypesForModel[0]?.slug ?? "");

  const selectedVariant = variants.find(
    (variant) =>
      variant.phoneModel?.slug === selectedModelSlug &&
      variant.caseType?.slug === activeCaseTypeSlug,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={modelId}
          className="text-sm font-semibold tracking-wide text-ink uppercase"
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
          className="w-full max-w-xs rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {models.map((model) =>
            model ? (
              <option key={model.slug} value={model.slug}>
                {model.brand.name} {model.name}
              </option>
            ) : null,
          )}
        </select>
      </div>

      {caseTypesForModel.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={caseTypeId}
            className="text-sm font-semibold tracking-wide text-ink uppercase"
          >
            Case type
          </label>
          <select
            id={caseTypeId}
            value={activeCaseTypeSlug}
            onChange={(event) => setSelectedCaseTypeSlug(event.target.value)}
            className="w-full max-w-xs rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
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
      ) : (
        <p className="text-sm text-muted-foreground">
          This combination isn&apos;t available.
        </p>
      )}

      {selectedVariant?.isAvailable && (
        <div className="flex items-center gap-3">
          <label htmlFor={`${modelId}-qty`} className="sr-only">
            Quantity
          </label>
          <div className="flex items-center rounded-sm border border-border">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="px-3 py-2 text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
              className="px-3 py-2 text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              +
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!selectedVariant?.isAvailable || status === "adding"}
        onClick={async () => {
          if (!selectedVariant) return;
          setStatus("adding");
          await addItem(selectedVariant.id, quantity);
          setStatus("added");
        }}
        title={
          !selectedVariant?.isAvailable
            ? "This combination is out of stock"
            : undefined
        }
        className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink/40"
      >
        {status === "adding" ? "Adding…" : "Add to cart"}
      </button>

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
