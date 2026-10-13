"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
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
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-ink">
            Bundles
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Create quantity-based offers such as &quot;Any 2 cases for 450
            EGP.&quot; Prices are always re-checked by the server, and a bundle
            can never increase what a customer pays.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView({ mode: "editor", bundle: null })}
          className={primaryButtonClass}
        >
          + Create bundle
        </button>
      </div>

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

      {isLoading && <LoadingRow label="Loading bundles…" />}
      {error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {error}
        </p>
      )}

      {!isLoading && bundles.length === 0 && !error && (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
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
        <ul className="mt-6 flex flex-col gap-3">
          {bundles.map((bundle) => {
            const status = STATUS_STYLES[bundle.status];
            const schedule = scheduleText(bundle);
            const busy = busyId === bundle.id;
            return (
              <li
                key={bundle.id}
                className="grid gap-4 rounded-3xl border border-border p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">{bundle.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {bundle.showAnnouncementBanner && (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold uppercase text-white">
                        {bundle.status === "ACTIVE"
                          ? bannerWinner(bundles)?.id === bundle.id
                            ? "Banner live"
                            : "Banner hidden"
                          : "Banner on"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink">
                    {bundle.bundleSize} items →{" "}
                    {bundle.fixedTotal !== null && bundle.currency
                      ? formatPrice(bundle.fixedTotal, bundle.currency)
                      : "No price set"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bundleScopeLabel(bundle)}
                  </p>
                  {schedule && (
                    <p className="text-sm text-muted-foreground">{schedule}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {bundle.isRepeatable ? "Repeatable" : "Once per order"} ·{" "}
                  {bundle.allowCouponStacking ? "Stacks with coupons" : "No coupon stacking"}
                  {bundle.requireDifferentPhoneModels && " · Different phone models"}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setView({ mode: "editor", bundle })}
                    disabled={busy}
                    className={linkButtonClass}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(bundle)}
                    disabled={busy}
                    className={linkButtonClass}
                  >
                    {bundle.isEnabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(bundle)}
                    disabled={busy}
                    className="text-sm font-semibold text-accent underline underline-offset-4 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
