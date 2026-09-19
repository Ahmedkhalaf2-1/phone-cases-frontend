"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";

export function ReceiptViewer({ receiptId }: { receiptId: string }) {
  const { authorizedFetch } = useAdminAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    let cancelled = false;
    authorizedFetch((token) => adminClient.getReceiptFile(token, receiptId))
      .then((blob) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load receipt.");
      });
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [authorizedFetch, receiptId]);

  if (error) return <p className="text-xs text-accent">{error}</p>;
  if (!objectUrl) return <p className="text-xs text-muted-foreground">Loading receipt…</p>;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsEnlarged(true)}
        className="block w-24 overflow-hidden rounded-2xl border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={objectUrl} alt="Payment receipt" className="aspect-square w-full object-cover" />
      </button>
      {isEnlarged && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Receipt image"
          onClick={() => setIsEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={objectUrl}
            alt="Payment receipt (enlarged)"
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
          <button
            type="button"
            onClick={() => setIsEnlarged(false)}
            aria-label="Close"
            className="absolute end-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-ink"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
