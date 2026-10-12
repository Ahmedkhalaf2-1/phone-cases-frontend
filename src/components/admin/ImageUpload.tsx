"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeImageFile } from "@/lib/image-normalize";

/** Matches the backend's `POST /admin/media/upload` limits. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please choose a JPG, PNG or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`;
  }
  return null;
}

/**
 * A button (or any trigger) that opens the OS file picker and hands back
 * one validated image. The hidden input is reset after each pick so
 * choosing the same file twice still fires.
 */
export function ImageFileButton({
  onSelect,
  onInvalid,
  className,
  disabled,
  children,
  ariaLabel,
}: {
  onSelect: (file: File) => void;
  onInvalid: (message: string) => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={[...ACCEPTED_IMAGE_TYPES, "image/heic", "image/heif", ".heic", ".heif"].join(",")}
        className="hidden"
        tabIndex={-1}
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (!picked) return;
          let file: File;
          try {
            // iPhone HEIC photos → JPEG; the backend only takes JPG/PNG/WebP.
            file = await normalizeImageFile(picked);
          } catch {
            onInvalid("Couldn't read this photo. Please export it as JPG or PNG and try again.");
            return;
          }
          const problem = validateImageFile(file);
          if (problem) onInvalid(problem);
          else onSelect(file);
        }}
      />
    </>
  );
}

/**
 * Points an <img> at a local file without uploading it. The object URL
 * is created and revoked in the same effect so it can't leak or be used
 * after it's revoked.
 */
function useFilePreview(file: File | null) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (!file || !img) return;
    const url = URL.createObjectURL(file);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return imgRef;
}

/**
 * Preview-then-confirm step for every image upload in the admin: shows
 * the image that's there now next to the one about to replace it, so
 * nothing is uploaded until the admin has seen it.
 */
export function ImageUploadDialog({
  file,
  title,
  currentImageUrl,
  confirmLabel,
  aspect = "square",
  withAltText = true,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  title: string;
  currentImageUrl?: string | null;
  confirmLabel: string;
  aspect?: "square" | "cover";
  withAltText?: boolean;
  onCancel: () => void;
  /** Throw (or reject) to keep the dialog open and show the message. */
  onConfirm: (altText: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useFilePreview(file);
  const [altText, setAltText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (file && !dialog.open) {
      dialog.showModal();
    } else if (!file && dialog.open) {
      dialog.close();
    }
  }, [file]);

  async function handleConfirm() {
    setIsUploading(true);
    setError(null);
    try {
      await onConfirm(altText.trim());
      setAltText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function cancel() {
    setAltText("");
    setError(null);
    onCancel();
  }

  const frame =
    aspect === "cover"
      ? "aspect-[16/10] w-full object-cover object-top"
      : "aspect-square w-full object-cover";

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!isUploading) cancel();
      }}
      className="m-auto w-[min(100%-2rem,48rem)] rounded-card bg-background p-0 text-ink shadow-card backdrop:bg-black/50"
    >
      <div className="p-5 sm:p-6">
        <h2 className="font-display text-2xl tracking-tight uppercase">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check the new image below. Nothing changes until you press{" "}
          <strong className="text-ink">{confirmLabel}</strong>.
        </p>

        <div className={`mt-5 grid gap-4 ${currentImageUrl ? "sm:grid-cols-2" : ""}`}>
          {currentImageUrl && (
            <figure>
              <figcaption className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Now
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentImageUrl} alt="" className={`${frame} rounded-2xl bg-surface opacity-80`} />
            </figure>
          )}
          <figure>
            <figcaption className="mb-2 text-xs font-semibold tracking-wide text-accent uppercase">
              {currentImageUrl ? "New" : "Preview"}
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={previewRef}
              key={file ? `${file.name}-${file.lastModified}-${file.size}` : "none"}
              alt=""
              className={`${frame} rounded-2xl bg-surface ring-2 ring-accent`}
            />
            {file && (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </figure>
        </div>

        {withAltText && (
          <label className="mt-4 flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">
              Short description <span className="font-normal text-muted-foreground">(optional, helps accessibility)</span>
            </span>
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="e.g. Black case with Messi #10 print"
              className="rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={isUploading}
            className="rounded-pill border border-border px-5 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isUploading || !file}
            className="rounded-pill bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {isUploading ? "Uploading…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
