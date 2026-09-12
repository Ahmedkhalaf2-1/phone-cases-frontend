"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function TrackOrderPage() {
  const router = useRouter();
  const [trackingToken, setTrackingToken] = useState("");
  const inputId = useId();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const token = trackingToken.trim();
    if (token) router.push(`/orders/track/${encodeURIComponent(token)}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
          <h1 className="mb-2 font-display text-4xl tracking-tight text-ink uppercase">
            Track order
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter the tracking link/code you received after checkout.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor={inputId} className="sr-only">
              Tracking token
            </label>
            <input
              id={inputId}
              required
              value={trackingToken}
              onChange={(e) => setTrackingToken(e.target.value)}
              placeholder="Tracking token"
              className="w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Track
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
