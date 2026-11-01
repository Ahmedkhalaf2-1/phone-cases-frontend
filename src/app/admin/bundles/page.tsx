"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { Switch } from "@/components/admin/form-kit";
import { BundleEditor } from "@/components/admin/bundles/BundleEditor";
import {
  bannerWinner,
  bundleScopeLabel,
  linkButtonClass,
  primaryButtonClass,
} from "@/components/admin/bundles/bundle-utils";
import type { AdminBundle } from "@/lib/admin/types";

type View = { mode: "list" } | { mode: "editor"; bundle: AdminBundle | null };

const STATUS_STYLES: Record<AdminBundle["status"], { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-800" },
  SCHEDULED: { label: "Scheduled", className: "bg-amber-100 text-amber-800" },
  EXPIRED: { label: "Expired", className: "bg-surface text-muted-foreground" },
  DISABLED: { label: "Disabled", className: "bg-surface text-muted-foreground" },
};

function scheduleText(bundle: AdminBundle): string | null {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (bundle.startsAt && bundle.expiresAt) {
    return `${fmt(bundle.startsAt)} → ${fmt(bundle.expiresAt)}`;
  }
  if (bundle.startsAt) return `Starts ${fmt(bundle.startsAt)}`;
  if (bundle.expiresAt) return `Ends ${fmt(bundle.expiresAt)}`;
  return null;
}

export default function AdminBundlesPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ mode: "list" });

  const load = useCallback(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listBundles(token))
      .then((result) => {
        setBundles(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load bundles."),
      )
      .finally(() => setIsLoading(false));
  }, [accessToken, authorizedFetch]);

  useEffect(load, [load]);

  async function handleToggleEnabled(bundle: AdminBundle) {
    setBusyId(bundle.id);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateBundle(token, bundle.id, { isEnabled: !bundle.isEnabled }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update bundle.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(bundle: AdminBundle) {
    if (!window.confirm(`Delete “${bundle.name}”? This cannot be undone.`)) return;
    setBusyId(bundle.id);
    setError(null);
    try {
      await authorizedFetch((token) => adminClient.deleteBundle(token, bundle.id));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete bundle.");
    } finally {
      setBusyId(null);
    }
  }

  if (view.mode === "editor") {
    return (
      <div className="max-w-6xl">
        <button
          type="button"
          onClick={() => setView({ mode: "list" })}
          className={linkButtonClass}
        >
          ← All bundles
        </button>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-ink">
          {view.bundle ? "Edit bundle" : "Create bundle"}
        </h1>
        <BundleEditor
          key={view.bundle?.id ?? "new"}
          bundle={view.bundle}
          otherBundles={bundles.filter((b) => b.id !== view.bundle?.id)}
          onCancel={() => setView({ mode: "list" })}
          onSaved={() => {
            setView({ mode: "list" });
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-tight text-ink">Bundles</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Quantity offers like &quot;Any 2 cases for 450 EGP&quot;. A bundle can never make a customer pay more.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView({ mode: "editor", bundle: null })}
          className={primaryButtonClass}
        >
          + Create bundle
        </button>
      </header>

      {(() => {
        const live = bannerWinner(bundles);
        const competing = bundles.filter(
          (b) => b.status === "ACTIVE" && b.showAnnouncementBanner,
        );
        if (!live || competing.length < 2) return null;
        return (
          <p role="status" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">
              {competing.length} active bundles have the announcement banner on.
            </span>{" "}
            Only one banner can show at a time. The oldest-created active bundle wins, so the
            storefront is showing “{live.name}”. Turn the banner off on the others to remove this
            warning.
          </p>
        );
      })()}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading && (
        <ul aria-hidden className="mt-6 grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="h-44 animate-pulse rounded-card bg-surface" />
          ))}
        </ul>
      )}

      {!isLoading && bundles.length === 0 && !error && (
        <div className="mt-6 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">No bundles yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with a simple “Any 2 for a fixed price” offer.
          </p>
          <button
            type="button"
            onClick={() => setView({ mode: "editor", bundle: null })}
            className={`${primaryButtonClass} mt-4`}
          >
            + Create bundle
          </button>
        </div>
      )}

      {bundles.length > 0 && (
        <ul className="mt-6 grid gap-3 lg:grid-cols-2">
          {bundles.map((bundle) => {
            const status = STATUS_STYLES[bundle.status];
            const schedule = scheduleText(bundle);
            const busy = busyId === bundle.id;
            const muted = bundle.status === "EXPIRED" || bundle.status === "DISABLED";
            const bannerLabel = bundle.showAnnouncementBanner
              ? bundle.status === "ACTIVE"
                ? bannerWinner(bundles)?.id === bundle.id
                  ? "Banner live"
                  : "Banner hidden"
                : "Banner on"
              : null;
            const rules = [
              bundle.isRepeatable ? "Repeatable" : "Once per order",
              bundle.allowCouponStacking ? "Stacks with coupons" : "No coupons on top",
              ...(bundle.requireDifferentPhoneModels ? ["Different phone models"] : []),
            ];
            return (
              <li key={bundle.id} className="flex overflow-hidden rounded-card bg-surface shadow-card">
                {/* Stub: the offer itself */}
                <div
                  className={`relative flex w-28 shrink-0 flex-col items-center justify-center border-e-2 border-dashed border-surface px-3 py-5 text-center sm:w-32 ${
                    muted ? "bg-muted-foreground/70 text-white" : "bg-ink text-white"
                  }`}
                >
                  <span className="font-display text-4xl leading-none">{bundle.bundleSize}</span>
                  <span className="mt-1 text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">items for</span>
                  <span className="mt-2 text-sm font-semibold">
                    {bundle.fixedTotal !== null && bundle.currency
                      ? formatPrice(bundle.fixedTotal, bundle.currency)
                      : "No price"}
                  </span>
                  <span aria-hidden className="absolute -end-2.5 -top-2.5 size-5 rounded-full bg-background" />
                  <span aria-hidden className="absolute -end-2.5 -bottom-2.5 size-5 rounded-full bg-background" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setView({ mode: "editor", bundle })}
                      className="min-w-0 truncate text-start font-semibold text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {bundle.name}
                    </button>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{bundleScopeLabel(bundle)}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {rules.map((rule) => (
                      <li key={rule} className="rounded-full bg-background px-2 py-0.5 text-xs text-ink">
                        {rule}
                      </li>
                    ))}
                    {bannerLabel && (
                      <li
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          bannerLabel === "Banner live" ? "bg-accent text-white" : "bg-background text-muted-foreground"
                        }`}
                      >
                        {bannerLabel}
                      </li>
                    )}
                  </ul>
                  {schedule && <p className="text-xs text-muted-foreground">{schedule}</p>}

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Switch
                        checked={bundle.isEnabled}
                        disabled={busy}
                        onChange={() => handleToggleEnabled(bundle)}
                        label={`${bundle.name} enabled`}
                      />
                      {busy ? "Saving…" : bundle.isEnabled ? "On" : "Off"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(bundle)}
                        disabled={busy}
                        aria-label={`Delete ${bundle.name}`}
                        title="Delete"
                        className="rounded-pill p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
                          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setView({ mode: "editor", bundle })}
                        disabled={busy}
                        className="rounded-pill border border-border bg-background px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
