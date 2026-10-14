"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useI18n } from "@/i18n/I18nProvider";

export default function TrackOrderPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [trackingToken, setTrackingToken] = useState("");
  const inputId = useId();

  /**
   * The confirmation page's "Copy tracking link" button copies the full
   * URL, and this page's own placeholder invites pasting a "link" too —
   * so a bare token and a full pasted link must both work here, or
   * pasting the exact thing customers are told to copy silently breaks.
   */
  function extractTrackingToken(input: string): string {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      return segments[segments.length - 1] ?? "";
    } catch {
      return trimmed;
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const token = extractTrackingToken(trackingToken);
    if (token) router.push(`/orders/track/${encodeURIComponent(token)}`);
  }

  return (
    <>
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
          <h1 className="mb-2 font-display text-4xl tracking-tighter text-ink">
            {t("orders.trackTitle")}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("orders.trackIntro")}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor={inputId} className="sr-only">
              {t("orders.trackingToken")}
            </label>
            <input
              id={inputId}
              required
              value={trackingToken}
              onChange={(e) => setTrackingToken(e.target.value)}
              placeholder={t("orders.trackingToken")}
              dir="ltr"
              className="w-full rounded-pill border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("orders.track")}
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
