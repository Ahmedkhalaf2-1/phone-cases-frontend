"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import { useCart } from "@/lib/cart/CartProvider";
import { liveCartClient } from "@/lib/cart/live-cart-client";
import type { PublicVariant } from "@/lib/api/types";
import { CaseMockup, useCaseMockup } from "@/components/customize/CaseMockup";
import { normalizeImageFile } from "@/lib/image-normalize";
import type { CustomDesign } from "@/lib/cart/types";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** iPhone photos (HEIC/HEIF) are accepted too and converted to JPEG before upload. */
const PICKER_ACCEPT = [...ACCEPTED_TYPES, "image/heic", "image/heif", ".heic", ".heif"].join(",");
const MAX_BYTES = 10 * 1024 * 1024;

type Phase = "idle" | "uploading" | "previewing" | "ready" | "adding" | "added";

interface StoredDesign {
  designId: string;
  variantId: string;
}

function storageKey(productSlug: string) {
  return `custom-design:${productSlug}`;
}

function readStored(productSlug: string): StoredDesign | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(productSlug));
    return raw ? (JSON.parse(raw) as StoredDesign) : null;
  } catch {
    return null;
  }
}

function writeStored(productSlug: string, value: StoredDesign | null) {
  try {
    if (value) window.sessionStorage.setItem(storageKey(productSlug), JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey(productSlug));
  } catch {
    // Storage unavailable (private mode) — the design just won't survive a refresh.
  }
}

function uploadErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  if (err.kind === "network") return "We couldn't reach the server. Check your connection and try again.";
  const text = `${err.code ?? ""} ${err.message}`.toLowerCase();
  if (err.status === 429) return "You've uploaded several images in a short time. Please wait a minute and try again.";
  if (text.includes("limit")) {
    return "You've reached the maximum number of custom designs for one bag. Remove some items or check out first.";
  }
  if (err.status === 409 || text.includes("personaliz")) {
    return "This phone model / case can't be personalized. Please choose another one.";
  }
  if (err.status === 400) {
    return err.message || "That file couldn't be used. Use a JPG, PNG or WebP image under 10 MB.";
  }
  return err.message || "Upload failed. Please try again.";
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
  if (file.size > MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  }
  return null;
}

/** Fraction of the print size the uploaded image covers (1 = full resolution). */
function qualityRatio(design: CustomDesign): number {
  const { width, height } = design.original;
  const { widthPx, heightPx } = design.print;
  if (!width || !height || !widthPx || !heightPx) return 1;
  // The server scales the image to cover the print area and never
  // upscales, so the side that needs the most stretching decides.
  return Math.min(1, width / widthPx, height / heightPx);
}

export function CustomizeStudio({
  productSlug,
  productName,
  variants: allVariants,
}: {
  productSlug: string;
  productName: string;
  variants: PublicVariant[];
}) {
  const { token, addItem, source } = useCart();
  const { mockup, isLoading: isMockupLoading } = useCaseMockup();
  const ids = { brand: useId(), model: useId(), file: useId(), note: useId() };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variants = useMemo(() => allVariants.filter((v) => v.isPersonalizable), [allVariants]);

  const brands = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string }>();
    for (const v of variants) if (v.phoneModel) seen.set(v.phoneModel.brand.slug, v.phoneModel.brand);
    return [...seen.values()];
  }, [variants]);

  const [brandSlug, setBrandSlug] = useState(() => (brands.length === 1 ? brands[0].slug : ""));
  const [modelSlug, setModelSlug] = useState("");
  const [caseTypeSlug, setCaseTypeSlug] = useState("");

  const models = useMemo(() => {
    const seen = new Map<string, NonNullable<PublicVariant["phoneModel"]>>();
    for (const v of variants) {
      if (v.phoneModel && v.phoneModel.brand.slug === brandSlug) seen.set(v.phoneModel.slug, v.phoneModel);
    }
    return [...seen.values()];
  }, [variants, brandSlug]);

  const caseOptions = useMemo(
    () => variants.filter((v) => v.phoneModel?.slug === modelSlug),
    [variants, modelSlug],
  );

  const variant =
    caseOptions.length === 1
      ? caseOptions[0]
      : caseOptions.find((v) => (v.caseType?.slug ?? "") === caseTypeSlug);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [design, setDesign] = useState<CustomDesign | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const localImgRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  // Restore a design from before a refresh.
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!token || source !== "live" || restoredFor.current === token) return;
    restoredFor.current = token;
    const stored = readStored(productSlug);
    if (!stored) return;
    const storedVariant = variants.find((v) => v.id === stored.variantId);
    if (!storedVariant?.phoneModel) {
      writeStored(productSlug, null);
      return;
    }
    liveCartClient
      .getCustomDesign(token, stored.designId)
      .then((restored) => {
        setBrandSlug(storedVariant.phoneModel!.brand.slug);
        setModelSlug(storedVariant.phoneModel!.slug);
        setCaseTypeSlug(storedVariant.caseType?.slug ?? "");
        setDesign(restored);
        setPhase("previewing");
      })
      .catch(() => writeStored(productSlug, null));
  }, [token, source, productSlug, variants]);

  // Load the mockup for the current design. The preview needs the cart
  // header, so it's fetched as a blob instead of used as an <img src>.
  useEffect(() => {
    if (!design || !token) return;
    let url: string | null = null;
    let cancelled = false;
    liveCartClient
      .getCustomDesignPreview(token, design.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPhase((p) => (p === "previewing" ? "ready" : p));
      })
      .catch(() => {
        if (cancelled) return;
        setError("Your image was uploaded, but the preview couldn't be created. Try uploading it again.");
        setPhase("idle");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [design, token]);

  // Local copy of the chosen file, for the crop guide. Set on the <img>
  // directly so the object URL is created and revoked in one place.
  const showCropGuide = Boolean(lastFile && design);
  useEffect(() => {
    const img = localImgRef.current;
    if (!lastFile || !img) return;
    const url = URL.createObjectURL(lastFile);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [lastFile, showCropGuide]);

  async function upload(file: File, target: PublicVariant) {
    if (!token) {
      setError("Your bag is still loading. Try again in a moment.");
      return;
    }
    setError(null);
    setNotice(null);
    setProgress(0);
    setPhase("uploading");
    setPreviewUrl(null);
    try {
      const created = await liveCartClient.uploadCustomDesign(token, { file, variantId: target.id }, setProgress);
      // Each upload is a new design; only the newest one is used.
      setDesign(created);
      writeStored(productSlug, { designId: created.id, variantId: target.id });
      setPhase("previewing");
    } catch (err) {
      setError(uploadErrorMessage(err));
      setPhase(design ? "ready" : "idle");
    }
  }

  async function chooseFile(picked: File | undefined) {
    if (!picked) return;
    if (!variant) {
      setError("Choose your phone model first.");
      return;
    }
    let file: File;
    try {
      setError(null);
      setNotice("Preparing your photo…");
      file = await normalizeImageFile(picked);
      setNotice(null);
    } catch {
      setNotice(null);
      setError("We couldn't read this photo. Please choose a JPG or PNG, or take a screenshot of it and upload that.");
      return;
    }
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (!variant) {
      setError("Choose your phone model first.");
      return;
    }
    setLastFile(file);
    void upload(file, variant);
  }

  /** A design belongs to one variant — re-apply the image when it changes. */
  function onVariantChanged(next: PublicVariant | undefined) {
    if (!design || !next || next.id === design.variantId) return;
    if (lastFile) {
      setNotice(`Placing your image on the ${next.phoneModel?.name ?? "new"} case…`);
      void upload(lastFile, next);
    } else {
      setDesign(null);
      setPreviewUrl(null);
      writeStored(productSlug, null);
      setPhase("idle");
      setNotice("You changed the phone model. Please upload your image again.");
    }
  }

  function resolve(brand: string, model: string, caseType: string) {
    const options = variants.filter((v) => v.phoneModel?.brand.slug === brand && v.phoneModel?.slug === model);
    return options.length === 1 ? options[0] : options.find((v) => (v.caseType?.slug ?? "") === caseType);
  }

  async function handleAddToCart() {
    if (!variant || !design) return;
    setPhase("adding");
    setError(null);
    try {
      await addItem(variant.id, quantity, note.trim() || undefined, design.id);
      writeStored(productSlug, null);
      setPhase("added");
    } catch (err) {
      setError(err instanceof ApiError ? uploadErrorMessage(err) : "Could not add to your bag.");
      setPhase("ready");
    }
  }

  function startOver() {
    setDesign(null);
    setPreviewUrl(null);
    setLastFile(null);
    setNote("");
    setQuantity(1);
    setPhase("idle");
    setNotice(null);
    setError(null);
  }

  if (source === "demo") {
    return (
      <p className="rounded-card bg-surface p-6 text-sm text-muted-foreground shadow-card">
        Designing your own case needs the live shop. It isn&apos;t available in demo mode.
      </p>
    );
  }

  const currency = variant?.currency ?? variants[0]?.currency ?? "EGP";
  const surcharge = variant?.customizationPrice ?? 0;
  const ratio = design ? qualityRatio(design) : 1;
  const busy = phase === "uploading" || phase === "previewing" || phase === "adding";

  // Server center-crops to the print area's shape: show what survives.
  const crop =
    design && design.print.widthPx && design.print.heightPx && design.original.width && design.original.height
      ? (() => {
          const imageRatio = design.original.width / design.original.height;
          const printRatio = design.print.widthPx / design.print.heightPx;
          return imageRatio > printRatio
            ? { width: (printRatio / imageRatio) * 100, height: 100 }
            : { width: 100, height: (imageRatio / printRatio) * 100 };
        })()
      : null;

  const selectClass =
    "w-full rounded-pill border border-border bg-background px-4 py-3 text-sm text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      {/* Preview */}
      <section
        aria-label="Preview"
        className="order-2 rounded-card bg-surface p-3 shadow-card lg:sticky lg:top-6 lg:order-1"
      >
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-card-inner bg-background">
          {mockup ? (
            // The real case photo, with the customer's image shown the
            // moment they pick it — no waiting for the upload.
            <div className="h-full w-full p-4">
              <CaseMockup mockup={mockup} file={lastFile} alt={`Your design on the ${productName}`} />
            </div>
          ) : previewUrl && phase !== "uploading" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`Your design on the ${productName}`} className="h-full w-full object-contain" />
          ) : phase === "uploading" ? (
            <div className="flex w-2/3 flex-col items-center gap-3 text-center">
              <p className="text-sm font-semibold text-ink">Uploading… {Math.round(progress * 100)}%</p>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-surface">
                <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          ) : phase === "previewing" ? (
            <div className="flex flex-col items-center gap-3 text-sm font-semibold text-ink">
              <span className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
              Placing your image on the case…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <PhoneIcon className="size-16 text-border" />
              {isMockupLoading ? "" : "Your case preview will appear here."}
            </div>
          )}
          {mockup && lastFile && (phase === "uploading" || phase === "previewing") && (
            <p className="absolute inset-x-4 bottom-4 rounded-pill bg-background/90 px-4 py-2 text-center text-xs font-semibold text-ink shadow-card">
              {phase === "uploading" ? `Uploading… ${Math.round(progress * 100)}%` : "Preparing your print…"}
            </p>
          )}
        </div>
        {mockup ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            {design && !lastFile
              ? "Your design is saved. Choose the photo again to see it on the case."
              : `The center of your image is printed. Your ${variant?.phoneModel?.name ?? "phone"} case will have the right camera cut-out.`}
          </p>
        ) : (
          previewUrl && (
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Preview on a standard case. Your {variant?.phoneModel?.name ?? "phone"} case will have the right camera
              cut-out.
            </p>
          )
        )}
      </section>

      {/* Steps */}
      <div className="order-1 flex flex-col gap-4 lg:order-2">
        <Step number={1} title="Choose your phone">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.brand} className="text-sm font-medium text-ink">
                Brand
              </label>
              <select
                id={ids.brand}
                value={brandSlug}
                disabled={busy}
                onChange={(e) => {
                  setBrandSlug(e.target.value);
                  setModelSlug("");
                  setCaseTypeSlug("");
                }}
                className={selectClass}
              >
                <option value="">Select brand</option>
                {brands.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.model} className="text-sm font-medium text-ink">
                Model
              </label>
              <select
                id={ids.model}
                value={modelSlug}
                disabled={busy || !brandSlug}
                onChange={(e) => {
                  setModelSlug(e.target.value);
                  setCaseTypeSlug("");
                  onVariantChanged(resolve(brandSlug, e.target.value, ""));
                }}
                className={selectClass}
              >
                <option value="">Select model</option>
                {models.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {caseOptions.length > 1 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-ink">Case type</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {caseOptions.map((option) => {
                  const slug = option.caseType?.slug ?? "";
                  const selected = variant?.id === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={busy || !option.isAvailable}
                      aria-pressed={selected}
                      onClick={() => {
                        setCaseTypeSlug(slug);
                        onVariantChanged(option);
                      }}
                      className={`rounded-pill border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                        selected ? "border-ink bg-ink text-white" : "border-border bg-background text-ink hover:border-ink"
                      }`}
                    >
                      {option.caseType?.name ?? "Standard"} ·{" "}
                      {formatPrice(option.price + (option.customizationPrice ?? 0), option.currency)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {variant && (
            <p className="mt-4 text-sm text-ink">
              <span className="font-display text-2xl">{formatPrice(variant.price + surcharge, currency)}</span>
              {surcharge > 0 && (
                <span className="ms-2 text-muted-foreground">
                  ({formatPrice(variant.price, currency)} case + {formatPrice(surcharge, currency)} for your design)
                </span>
              )}
              {!variant.isAvailable && <span className="ms-2 font-semibold text-accent">Out of stock</span>}
            </p>
          )}
        </Step>

        <Step number={2} title="Upload your image" disabled={!variant}>
          <label
            htmlFor={ids.file}
            onDragOver={(e) => {
              e.preventDefault();
              if (variant && !busy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (variant && !busy) void chooseFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-6 text-center transition-colors ${
              !variant || busy ? "pointer-events-none opacity-50" : ""
            } ${isDragging ? "border-accent bg-accent-wash" : "border-border hover:border-accent"}`}
          >
            <UploadIcon className="size-8 text-accent" />
            <span className="text-sm font-semibold text-ink">
              {design ? "Replace image" : "Choose a photo"}
              <span className="hidden font-normal text-muted-foreground sm:inline"> or drag it here</span>
            </span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WebP or iPhone photo · up to 10 MB</span>
          </label>
          <input
            ref={fileInputRef}
            id={ids.file}
            type="file"
            accept={PICKER_ACCEPT}
            disabled={!variant || busy}
            className="sr-only"
            onChange={(e) => {
              void chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            We fit your image to the case automatically and print the <strong className="text-ink">center</strong> of
            it. Keep faces and text away from the edges.
          </p>
        </Step>

        {(error || notice) && (
          <p
            role={error ? "alert" : "status"}
            className={`rounded-2xl p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-accent-wash text-ink"}`}
          >
            {error ?? notice}
          </p>
        )}

        {design && (
          <Step number={3} title="Check your design">
            {lastFile && crop && (
              <figure>
                <div
                  className="relative mx-auto max-h-64 overflow-hidden rounded-2xl bg-background"
                  style={{ aspectRatio: `${design.original.width} / ${design.original.height}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={localImgRef} alt="" className="h-full w-full object-contain" />
                  <div
                    aria-hidden
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-dashed border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                    style={{ width: `${crop.width}%`, height: `${crop.height}%` }}
                  />
                </div>
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  The bright area is what gets printed. The dark edges are trimmed.
                </figcaption>
              </figure>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-background p-2">
                <dt className="text-muted-foreground">Your image</dt>
                <dd className="font-semibold text-ink">
                  {design.original.width} × {design.original.height} px
                </dd>
              </div>
              <div className="rounded-2xl bg-background p-2">
                <dt className="text-muted-foreground">Print size</dt>
                <dd className="font-semibold text-ink">
                  {design.print.widthPx} × {design.print.heightPx} px
                </dd>
              </div>
            </dl>
            {ratio < 0.5 ? (
              <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
                This image is quite small for a case, so it will probably look blurry. Try a larger or original photo.
              </p>
            ) : ratio < 0.8 ? (
              <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                This image is a little small. It should print fine, but a larger photo will look sharper.
              </p>
            ) : (
              <p className="mt-3 text-sm font-semibold text-green-700">✓ Good quality for printing.</p>
            )}
          </Step>
        )}

        {design && phase !== "added" && (
          <Step number={4} title="Add to your bag">
            <label htmlFor={ids.note} className="text-sm font-medium text-ink">
              Note for us <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id={ids.note}
              dir="auto"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please keep the background black"
              className="mt-1.5 w-full resize-y rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-pill border border-border">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="min-h-11 min-w-11 px-3 text-ink"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  aria-label="Increase quantity"
                  className="min-h-11 min-w-11 px-3 text-ink"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="min-h-11 rounded-pill border border-border px-5 text-sm font-medium text-ink hover:border-ink disabled:opacity-50"
              >
                Replace image
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={busy || phase !== "ready" || !variant?.isAvailable}
              className="mt-4 inline-flex min-h-13 w-full items-center justify-center rounded-pill bg-ink px-6 py-3.5 text-sm font-medium text-white transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink/40"
            >
              {phase === "adding"
                ? "Adding…"
                : `Add to bag · ${formatPrice((variant ? variant.price + surcharge : 0) * quantity, currency)}`}
            </button>
          </Step>
        )}

        {phase === "added" && (
          <div className="rounded-card bg-surface p-5 shadow-card">
            <p className="font-semibold text-ink">✓ Your custom case is in your bag.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/cart"
                className="rounded-pill bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-accent"
              >
                View bag
              </Link>
              <button
                type="button"
                onClick={startOver}
                className="rounded-pill border border-border px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
              >
                Design another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  disabled,
  children,
}: {
  number: number;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`step-${number}`}
      className={`rounded-card bg-surface p-4 shadow-card sm:p-5 ${disabled ? "opacity-60" : ""}`}
    >
      <h2 id={`step-${number}`} className="mb-3 flex items-center gap-2 font-semibold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs text-white">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M12 16V4m0 0l-4 4m4-4l4 4M5 16v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="6" y="2" width="12" height="20" rx="3" stroke="currentColor" strokeWidth="1.25" />
      <rect x="8" y="4" width="4" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
