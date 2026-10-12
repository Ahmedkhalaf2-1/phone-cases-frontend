"use client";

import { useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { orderedMedia } from "@/lib/admin/product-display";
import { ImageFileButton, ImageUploadDialog } from "@/components/admin/ImageUpload";
import type { AdminProduct, MediaAsset } from "@/lib/admin/types";

type PendingUpload =
  | { kind: "add"; file: File }
  | { kind: "replace"; file: File; target: MediaAsset };

const iconButton =
  "flex size-8 items-center justify-center rounded-full bg-background/90 text-ink shadow-card transition-colors enabled:hover:bg-ink enabled:hover:text-white disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const textButton =
  "rounded-pill border border-border bg-background px-3 py-1 text-xs font-semibold transition-colors enabled:hover:border-ink disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Image-first media editor: the image customers see first, large, then
 * the full gallery in display order with per-image controls and
 * drag-to-reorder.
 *
 * Ordering uses `PUT /admin/media/products/:id/order`, which sets the
 * whole order (first = main image) in one transaction.
 */
export function ProductMediaManager({
  product,
  onChanged,
}: {
  product: AdminProduct;
  onChanged: () => Promise<void> | void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const current = orderedMedia(product).map((a) => a.mediaAsset);

  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  // Show the new order immediately while it saves.
  const [targetOrder, setTargetOrder] = useState<MediaAsset[] | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const shown = targetOrder ?? current;
  const main = shown[0] ?? null;

  /** Saves `next` as the gallery order; the first image becomes the main one. */
  async function saveOrder(next: MediaAsset[], successMessage: string) {
    setTargetOrder(next);
    setIsWorking(true);
    setError(null);
    setStatus(null);
    try {
      await authorizedFetch((token) =>
        adminClient.reorderProductMedia(token, product.id, next.map((a) => a.id)),
      );
      await onChanged();
      setTargetOrder(null);
      setStatus(successMessage);
    } catch (err) {
      setTargetOrder(null);
      await onChanged();
      setError(err instanceof ApiError ? err.message : "Could not save the image order.");
    } finally {
      setIsWorking(false);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= shown.length || from === to) return;
    const next = [...shown];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void saveOrder(next, to === 0 ? "Main image updated." : "Order saved.");
  }

  async function remove(index: number) {
    const asset = shown[index];
    if (!window.confirm("Remove this image from the product?")) return;
    const next = shown.filter((_, i) => i !== index);
    setIsWorking(true);
    setError(null);
    setStatus(null);
    try {
      await authorizedFetch((token) =>
        adminClient.detachMediaFromProduct(token, product.id, asset.id),
      );
      if (index === 0 && next.length > 0) {
        // Removing the main image: make the next one main.
        await authorizedFetch((token) =>
          adminClient.reorderProductMedia(token, product.id, next.map((a) => a.id)),
        );
      }
      await onChanged();
      setStatus(index === 0 && next.length > 0 ? "Image removed. The next image is now the main image." : "Image removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the image.");
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmUpload(altText: string) {
    if (!pendingUpload) return;
    const upload = pendingUpload;
    const asset = await authorizedFetch((token) =>
      adminClient.uploadMedia(token, upload.file, altText || undefined),
    );
    setPendingUpload(null);
    setIsWorking(true);
    setError(null);
    try {
      if (upload.kind === "replace") {
        // Attach the new image, drop the old one, then put the new one in
        // the old one's place (the order call needs the exact attached set).
        await authorizedFetch((token) =>
          adminClient.attachMediaToProduct(token, product.id, { mediaAssetId: asset.id }),
        );
        await authorizedFetch((token) =>
          adminClient.detachMediaFromProduct(token, product.id, upload.target.id),
        );
        await authorizedFetch((token) =>
          adminClient.reorderProductMedia(
            token,
            product.id,
            shown.map((a) => (a.id === upload.target.id ? asset.id : a.id)),
          ),
        );
        await onChanged();
        setStatus("Image replaced.");
        return;
      }
      const maxOrder = Math.max(-1, ...(product.media ?? []).map((a) => a.displayOrder));
      await authorizedFetch((token) =>
        adminClient.attachMediaToProduct(token, product.id, {
          mediaAssetId: asset.id,
          displayOrder: maxOrder + 1,
          isPrimary: shown.length === 0,
        }),
      );
      await onChanged();
      setStatus(shown.length === 0 ? "Main image added." : "Image added to the gallery.");
    } catch (err) {
      await onChanged();
      setError(err instanceof ApiError ? err.message : "Uploaded, but could not add it to the product.");
    } finally {
      setIsWorking(false);
    }
  }

  function handleDrop(to: number) {
    if (dragIndex !== null) move(dragIndex, to);
    setDragIndex(null);
    setDropIndex(null);
  }

  const pick = (kind: "add") => (file: File) => setPendingUpload({ kind, file });

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>

        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {isWorking ? "Saving images…" : status}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Main image */}
        <div>
          <h3 className="text-sm font-semibold text-ink">Main image</h3>
          <p className="text-xs text-muted-foreground">What customers see first in the shop.</p>
          <div className="relative mt-2 aspect-square overflow-hidden rounded-card bg-surface shadow-card">
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={main.url}
                alt={main.altTextEn ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageFileButton
                onSelect={pick("add")}
                onInvalid={setError}
                disabled={isWorking}
                className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <PlusIcon className="size-8" />
                Add the main image
              </ImageFileButton>
            )}
            {isWorking && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm font-semibold">
                Saving…
              </div>
            )}
          </div>
          {main && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ImageFileButton
                onSelect={(file) => setPendingUpload({ kind: "replace", file, target: main })}
                onInvalid={setError}
                disabled={isWorking}
                className={textButton}
              >
                Replace main image
              </ImageFileButton>
            </div>
          )}
          {status && !isWorking && !error && (
            <p className="mt-3 text-sm font-semibold text-green-700">✓ {status}</p>
          )}
        </div>

        {/* Gallery */}
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Gallery <span className="font-normal text-muted-foreground">· {shown.length} image{shown.length === 1 ? "" : "s"}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Shown to customers in this order. Drag to reorder, or use the arrows.
          </p>
          <ol className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((asset, index) => (
              <li
                key={asset.id}
                draggable={!isWorking}
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  setDropIndex(index);
                }}
                onDragLeave={() => setDropIndex((d) => (d === index ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={`group flex flex-col rounded-card bg-surface p-2 shadow-card transition ${
                  dragIndex === index ? "opacity-40" : ""
                } ${dropIndex === index && dragIndex !== index ? "ring-2 ring-accent" : ""} ${
                  isWorking ? "" : "cursor-grab active:cursor-grabbing"
                }`}
              >
                <div className="relative aspect-square overflow-hidden rounded-card-inner bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.altTextEn ?? ""}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                  <span
                    className={`absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      index === 0 ? "bg-accent text-white" : "bg-background/90 text-ink"
                    }`}
                  >
                    {index === 0 ? "1 · Main" : index + 1}
                  </span>
                  <div className="absolute inset-x-2 bottom-2 flex justify-between">
                    <button
                      type="button"
                      disabled={isWorking || index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={`Move image ${index + 1} left`}
                      title="Move left"
                      className={iconButton}
                    >
                      <ArrowIcon className="size-4 rtl:rotate-180" direction="left" />
                    </button>
                    <button
                      type="button"
                      disabled={isWorking || index === shown.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Move image ${index + 1} right`}
                      title="Move right"
                      className={iconButton}
                    >
                      <ArrowIcon className="size-4 rtl:rotate-180" direction="right" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {index !== 0 && (
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => move(index, 0)}
                      className={`${textButton} border-accent text-accent`}
                    >
                      Set as main
                    </button>
                  )}
                  <ImageFileButton
                    onSelect={(file) => setPendingUpload({ kind: "replace", file, target: asset })}
                    onInvalid={setError}
                    disabled={isWorking}
                    className={textButton}
                  >
                    Replace
                  </ImageFileButton>
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => remove(index)}
                    className={`${textButton} text-red-700`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
            <li>
              <ImageFileButton
                onSelect={pick("add")}
                onInvalid={setError}
                disabled={isWorking}
                className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <PlusIcon className="size-7" />
                Add image
              </ImageFileButton>
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            JPG, PNG or WebP, up to 5 MB. Square images look best.
          </p>
        </div>
      </div>

      <ImageUploadDialog
        file={pendingUpload?.file ?? null}
        title={
          pendingUpload?.kind === "replace"
            ? "Replace image"
            : shown.length === 0
              ? "Add main image"
              : "Add image to gallery"
        }
        currentImageUrl={pendingUpload?.kind === "replace" ? pendingUpload.target.url : null}
        confirmLabel={pendingUpload?.kind === "replace" ? "Replace image" : "Upload image"}
        onCancel={() => setPendingUpload(null)}
        onConfirm={async (altText) => {
          try {
            await confirmUpload(altText);
          } catch (err) {
            throw new Error(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
          }
        }}
      />
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon({ className, direction }: { className?: string; direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
