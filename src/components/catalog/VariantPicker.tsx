"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useFormatPrice } from "@/i18n/useFormatPrice";
import { useCart } from "@/lib/cart/CartProvider";
import type { PhoneBrand, PublicVariant } from "@/lib/api/types";
import { Spinner } from "@/components/ui/Spinner";
import { OTHER_PHONE, customPhoneNote, fallbackVariants } from "@/lib/custom-phone";

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
  const { t } = useI18n();
  const formatPrice = useFormatPrice();
  const modelId = useId();
  const brandId = useId();
  const dockRef = useRef<HTMLDivElement>(null);
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
  const [customBrand, setCustomBrand] = useState("");
  const [customModel, setCustomModel] = useState("");
  const isCustomPhone = selectedModelSlug === OTHER_PHONE || selectedBrandSlug === OTHER_PHONE;
  // A brand already picked from the list needn't be typed again.
  const pickedBrand =
    selectedBrandSlug && selectedBrandSlug !== OTHER_PHONE
      ? brands.find((b) => b.slug === selectedBrandSlug)
      : undefined;
  const effectiveCustomBrand = pickedBrand ? pickedBrand.name : customBrand;
  const customDetailsDone =
    effectiveCustomBrand.trim().length > 0 && customModel.trim().length > 0;
  const customVariants = useMemo(() => fallbackVariants(variants), [variants]);

  const caseTypesForModel = useMemo(() => {
    if (isCustomPhone) {
      return customVariants.flatMap((v) => (v.caseType ? [v.caseType] : []));
    }
    if (!selectedModelSlug) return [];
    const seen = new Map<string, PublicVariant["caseType"]>();
    for (const variant of variants) {
      if (variant.phoneModel?.slug === selectedModelSlug && variant.caseType) {
        seen.set(variant.caseType.slug, variant.caseType);
      }
    }
    return Array.from(seen.values());
  }, [variants, selectedModelSlug, isCustomPhone, customVariants]);

  const [selectedCaseTypeSlug, setSelectedCaseTypeSlug] = useState("");

  const activeCaseTypeSlug = caseTypesForModel.some(
    (c) => c?.slug === selectedCaseTypeSlug,
  )
    ? selectedCaseTypeSlug
    : "";

  const isSelectionComplete =
    isAccessory ||
    (Boolean(selectedModelSlug) &&
      (!isCustomPhone || customDetailsDone) &&
      (caseTypesForModel.length === 0 || Boolean(activeCaseTypeSlug)));

  const selectedVariant = isAccessory
    ? variants[0]
    : isSelectionComplete && isCustomPhone
      ? customVariants.find(
          (v) => caseTypesForModel.length === 0 || v.caseType?.slug === activeCaseTypeSlug,
        )
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

  // The mobile dock is position: fixed, so reserve its height at the bottom
  // of the page (otherwise it would cover the footer). On sm+ the dock is
  // display: contents and reports 0, so nothing is reserved.
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || typeof ResizeObserver === "undefined") return;
    const body = document.body;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      const height = Math.round(dock.getBoundingClientRect().height);
      body.style.paddingBottom = height > 0 ? `${height}px` : "";
      // Lets other bottom-anchored UI (the bundle promo sheet) sit above it.
      if (height > 0) root.style.setProperty("--pdp-dock-h", `${height}px`);
      else root.style.removeProperty("--pdp-dock-h");
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      body.style.paddingBottom = "";
      root.style.removeProperty("--pdp-dock-h");
    };
  }, []);

  const hasBrandPicker = !isAccessory && brands.length > 1;

  // Mobile dock is progressive: each step appears once the previous one is
  // done, so it stays as short as possible. sm+ always shows everything.
  const showModelStep =
    !isAccessory && (!hasBrandPicker || Boolean(selectedBrandSlug));
  const showCaseStep =
    !isAccessory && allCaseTypes.length > 0 && Boolean(selectedModelSlug) &&
    (!isCustomPhone || customDetailsDone);
  const showPurchase = isSelectionComplete;
  const mobileOnlyWhen = (show: boolean) => (show ? "" : "max-sm:hidden");
  // The step the customer should act on next gets a stronger outline.
  const activeStep = hasBrandPicker && !selectedBrandSlug
    ? "brand"
    : !isAccessory && !selectedModelSlug
      ? "model"
      : isCustomPhone && !customDetailsDone
        ? "custom"
      : showCaseStep && !activeCaseTypeSlug
        ? "case"
        : null;
  const activeRing = (step: string) =>
    activeStep === step
      ? "max-sm:border-ink max-sm:font-semibold"
      : "";
  const stepIn =
    "max-sm:animate-[sf-message-in_var(--sf-dur-normal)_var(--sf-ease)_both]";

  return (
    <div className="flex flex-col gap-5">
      {/* Mobile (<640px): one fixed purchase dock. sm+: display: contents, so
          these children lay out in the page exactly as before (sm:order-*). */}
      <div
        ref={dockRef}
        className="flex flex-col gap-2 border-t border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:max-h-[70dvh] max-sm:overflow-y-auto max-sm:rounded-t-3xl sm:contents"
      >
      <div className={hasBrandPicker ? `grid gap-2 sm:contents ${showModelStep ? "grid-cols-[2fr_3fr]" : "grid-cols-1"}` : "contents"}>
      {!isAccessory && brands.length > 1 && (
        <div className="flex flex-col gap-1.5 sm:hidden">
          <label
            htmlFor={brandId}
            className="text-sm font-medium tracking-tight text-ink max-sm:sr-only"
          >
            {t("product.phoneBrand")}
          </label>
          <select
            id={brandId}
            data-active={activeStep === "brand"}
            value={selectedBrandSlug}
            onChange={(event) => {
              const brandSlug = event.target.value;
              setSelectedBrandSlug(brandSlug);
              // Drop a model/case type that no longer belongs to this brand.
              if (brandSlug === OTHER_PHONE) {
                setSelectedModelSlug(OTHER_PHONE);
                setSelectedCaseTypeSlug("");
                return;
              }
              if (selectedModelSlug === OTHER_PHONE) {
                setSelectedModelSlug("");
                setSelectedCaseTypeSlug("");
                return;
              }
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
            className={`sf-select w-full min-h-11 rounded-pill border border-border bg-background px-3 py-2.5 text-base text-ink ${activeRing("brand")} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
          >
            <option value="">{t("product.brandPlaceholder")}</option>
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
            <option value={OTHER_PHONE}>{t("product.otherPhone")}</option>
          </select>
        </div>
      )}

      {!isAccessory && (
        <div className={`flex flex-col gap-1.5 sm:order-1 ${mobileOnlyWhen(showModelStep)} ${stepIn}`}>
          <label
            htmlFor={modelId}
            className="text-sm font-medium tracking-tight text-ink max-sm:sr-only"
          >
            {t("product.phoneModel")}
          </label>
          <select
            id={modelId}
            data-active={activeStep === "model"}
            value={selectedModelSlug}
            onChange={(event) => {
              setSelectedModelSlug(event.target.value);
              setSelectedCaseTypeSlug("");
            }}
            className={`sf-select w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2.5 text-sm text-ink max-sm:min-h-11 max-sm:max-w-none max-sm:px-3 max-sm:text-base ${activeRing("model")} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
          >
            <option value="">{t("product.selectModel")}</option>
            {modelsForBrand.map((model) =>
              model ? (
                <option key={model.slug} value={model.slug}>
                  {/* With a brand picked (mobile only) the name alone is enough. */}
                  {selectedBrandSlug ? model.name : `${model.brand.name} ${model.name}`}
                </option>
              ) : null,
            )}
            <option value={OTHER_PHONE}>{t("product.otherPhone")}</option>
          </select>
        </div>
      )}

      </div>

      {!isAccessory && isCustomPhone && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 sm:order-1">
          <p className="text-xs text-muted-foreground">{t("product.customHint")}</p>
          {!pickedBrand && (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t("product.customBrand")}
            <input
              type="text"
              dir="auto"
              maxLength={60}
              value={customBrand}
              onChange={(e) => setCustomBrand(e.target.value)}
              placeholder={t("product.customBrandPlaceholder")}
              className="w-full rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-normal text-ink max-sm:min-h-11 max-sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t("product.customModel")}
            <input
              type="text"
              dir="auto"
              maxLength={60}
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder={t("product.customModelPlaceholder")}
              className="w-full rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-normal text-ink max-sm:min-h-11 max-sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>
        </div>
      )}

      {!isAccessory && allCaseTypes.length > 0 && (
        <div className={`flex flex-col gap-1.5 sm:order-2 ${mobileOnlyWhen(showCaseStep)} ${stepIn}`}>
          <label
            htmlFor={caseTypeId}
            className="text-sm font-medium tracking-tight text-ink max-sm:sr-only"
          >
            {t("product.caseType")}
          </label>
          <select
            id={caseTypeId}
            data-active={activeStep === "case"}
            disabled={!selectedModelSlug || (isCustomPhone && !customDetailsDone)}
            value={activeCaseTypeSlug}
            onChange={(event) => setSelectedCaseTypeSlug(event.target.value)}
            className={`sf-select w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2.5 text-sm text-ink max-sm:min-h-11 max-sm:max-w-none max-sm:px-3 max-sm:text-base ${activeRing("case")} disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
          >
            <option value="">
              {!selectedModelSlug
                ? t("product.selectModelFirst")
                : caseTypesForModel.length === 0
                ? t("product.noCaseTypes")
                : t("product.selectCaseType")}
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
        <div className={`sm:order-4 max-sm:flex max-sm:min-h-8 max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-3 max-sm:gap-y-0 ${mobileOnlyWhen(showPurchase)} ${stepIn}`}>
          <p className="font-display text-3xl text-ink max-sm:text-2xl">
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
            {selectedVariant.isAvailable ? t("common.inStock") : t("common.outOfStock")}
          </p>
        </div>
      ) : !isSelectionComplete ? (
        <div className={`sm:order-4 max-sm:flex max-sm:min-h-8 max-sm:items-baseline max-sm:gap-x-3 ${mobileOnlyWhen(showPurchase)} ${stepIn}`}>
          <p className="font-display text-3xl text-ink max-sm:text-2xl">
            <span className="text-lg font-normal text-muted-foreground max-sm:text-sm max-sm:font-medium max-sm:tracking-wider max-sm:uppercase">{t("common.from")} </span>
            {formatPrice(minPrice, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground max-sm:sr-only">
            {!selectedModelSlug
              ? t("product.selectModelHint")
              : t("product.selectCaseHint")}
          </p>
        </div>
      ) : (
        <p className={`text-sm text-muted-foreground sm:order-4 ${mobileOnlyWhen(showPurchase)}`}>
          {t("product.comboUnavailable")}
        </p>
      )}

      {bundleNote && (
        <p className={`rounded-xl bg-accent-wash px-3 py-2 text-[13px] leading-5 text-ink sm:order-5 max-sm:py-1.5 max-sm:text-xs max-sm:leading-4 ${mobileOnlyWhen(showPurchase)}`}>
          {bundleNote}
        </p>
      )}

      <div className={`flex flex-col gap-5 sm:order-6 max-sm:flex-row max-sm:items-stretch max-sm:gap-3 ${mobileOnlyWhen(showPurchase)} ${stepIn}`}>
      {selectedVariant?.isAvailable && (
        <div className="flex items-center gap-3 max-sm:shrink-0">
          <label htmlFor={`${modelId}-qty`} className="sr-only">
            {t("common.quantity")}
          </label>
          <div className="flex items-center rounded-pill border border-border max-sm:h-12">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label={t("common.decreaseQuantity")}
              className="min-h-11 min-w-11 px-3 py-2 text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
              className="w-12 border-x border-border bg-background py-2 text-center text-sm max-sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              aria-label={t("common.increaseQuantity")}
              className="min-h-11 min-w-11 px-3 py-2 text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
              isCustomPhone
                ? customPhoneNote(effectiveCustomBrand, customModel, itemNote)
                : itemNote.trim() || undefined,
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
            ? t("product.needModelFirst")
            : !isAccessory && !activeCaseTypeSlug && caseTypesForModel.length > 0
            ? t("product.needCaseFirst")
            : selectedVariant && !selectedVariant.isAvailable
            ? t("product.comboOutOfStock")
            : undefined
        }
        aria-busy={status === "adding"}
        className="inline-flex min-h-13 w-full max-w-xs items-center justify-center gap-2 max-sm:h-12 max-sm:min-h-0 max-sm:max-w-none max-sm:flex-1 rounded-pill bg-accent px-6 py-3.5 text-sm font-semibold tracking-tight text-accent-foreground transition-[background-color,transform] duration-[var(--sf-dur-fast)] enabled:hover:bg-accent/90 enabled:active:scale-[0.98] enabled:active:bg-accent/95 motion-reduce:transform-none disabled:cursor-not-allowed disabled:bg-accent/40 aria-busy:disabled:cursor-progress aria-busy:disabled:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {status === "adding" && <Spinner />}
        {status === "adding"
          ? t("product.adding")
          : !isAccessory && !selectedModelSlug
          ? t("product.selectModel")
          : !isAccessory && !activeCaseTypeSlug && caseTypesForModel.length > 0
          ? t("product.selectCaseType")
          : selectedVariant && !selectedVariant.isAvailable
          ? t("common.outOfStock")
          : t("product.addToCart")}
      </button>
      </div>

      {!isSelectionComplete && (
        <p className="text-xs text-muted-foreground max-sm:sr-only sm:order-7">
          {!selectedModelSlug
            ? t("product.pleaseSelectModel")
            : t("product.pleaseSelectCase")}
        </p>
      )}

      {status === "added" && !cartError && (
        <p className="sf-message-in text-sm text-ink sm:order-7 max-sm:text-[13px]">
          {t("product.addedToCart")}{" "}
          <Link href="/cart" className="font-semibold underline underline-offset-4">
            {t("product.viewCart")}
          </Link>
        </p>
      )}
      {cartError && <p className="text-sm text-accent sm:order-7 max-sm:text-[13px]">{cartError}</p>}
      </div>

      <div className="flex flex-col gap-1.5 max-sm:gap-1.5 sm:order-3">
        <label
          htmlFor={noteId}
          className="flex max-w-xs items-center justify-between gap-3 text-sm font-medium tracking-tight text-ink max-sm:max-w-none"
        >
          <span>{t("product.addNote")}</span>
          <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t("common.optional")}
          </span>
        </label>
        <textarea
          id={noteId}
          dir="auto"
          rows={2}
          maxLength={500}
          value={itemNote}
          onChange={(e) => setItemNote(e.target.value)}
          placeholder={t("product.notePlaceholder")}
          className="w-full max-w-xs rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-5 text-ink shadow-soft transition-colors placeholder:text-muted-foreground/70 hover:border-ink/30 max-sm:max-w-none max-sm:resize-none max-sm:text-base focus-visible:border-ink focus-visible:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink resize-y"
        />
        <div className={`flex justify-end max-w-xs max-sm:max-w-none ${itemNote.length === 0 ? "max-sm:hidden" : ""}`}>
          <span className="text-[11px] text-muted-foreground">
            {t("product.noteCounter", { count: itemNote.length })}
          </span>
        </div>
      </div>
    </div>
  );
}
