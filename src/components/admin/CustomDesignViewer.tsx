"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import type { AdminOrderCustomDesign } from "@/lib/admin/types";

/**
 * The customer's uploaded design on an order line: the mockup preview,
 * and downloads for the original upload and the print-ready file. All
 * three need staff auth, so they're fetched as blobs.
 */
export function CustomDesignViewer({
  design,
  fileBaseName,
}: {
  design: AdminOrderCustomDesign;
  fileBaseName: string;
}) {
  const { authorizedFetch } = useAdminAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"original" | "print" | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    authorizedFetch((token) => adminClient.getCustomDesignFile(token, design.files.preview))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError("Preview unavailable.");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [authorizedFetch, design.files.preview]);

  async function download(kind: "original" | "print") {
    setDownloading(kind);
    setError(null);
    try {
      const blob = await authorizedFetch((token) =>
        adminClient.getCustomDesignFile(token, design.files[kind]),
      );
      const ext = (kind === "print" ? design.print.mimeType : design.original.mimeType).split("/")[1] ?? "jpg";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileBaseName}-${kind}.${ext === "jpeg" ? "jpg" : ext}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  const button =
    "rounded-pill border border-border bg-background px-3 py-1 text-xs font-semibold enabled:hover:border-ink disabled:opacity-50";

  return (
    <div className="mt-2 flex gap-3 rounded-2xl border border-accent/30 bg-accent-wash p-2">
      <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-background">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Customer design preview" className="h-full w-full object-contain" />
        ) : (
          <span className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">
            {error ?? "Loading…"}
          </span>
        )}
      </div>
      <div className="min-w-0 text-xs">
        <p className="font-semibold text-ink">Customer&apos;s own design</p>
        <p className="text-muted-foreground">
          Upload {design.original.width}×{design.original.height}px → print {design.print.widthPx}×
          {design.print.heightPx}px @ {design.print.dpi} dpi
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" disabled={downloading !== null} onClick={() => download("print")} className={button}>
            {downloading === "print" ? "Downloading…" : "Download print file"}
          </button>
          <button type="button" disabled={downloading !== null} onClick={() => download("original")} className={button}>
            {downloading === "original" ? "Downloading…" : "Original upload"}
          </button>
        </div>
        {error && previewUrl && <p className="mt-1 text-red-700">{error}</p>}
      </div>
    </div>
  );
}
