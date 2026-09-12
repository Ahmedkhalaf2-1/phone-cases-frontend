"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminBundle } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminBundlesPage() {
  const { accessToken } = useAdminAuth();
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [name, setName] = useState("");
  const [fixedTotal, setFixedTotal] = useState("");
  const [variantIds, setVariantIds] = useState("");

  function load() {
    if (!accessToken) return;
    adminClient
      .listBundles(accessToken)
      .then((result) => {
        setBundles(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load bundles."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const ids = variantIds.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length < 2) {
      setError("A bundle needs at least two eligible variant ids.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await adminClient.createBundle(accessToken, {
        name,
        fixedTotal: Number(fixedTotal),
        currency: "EGP",
        eligibleVariants: ids.map((variantId) => ({ variantId })),
      });
      setName("");
      setFixedTotal("");
      setVariantIds("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create bundle.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleEnabled(bundle: AdminBundle) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await adminClient.updateBundle(accessToken, bundle.id, {
        isEnabled: !bundle.isEnabled,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update bundle.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await adminClient.deleteBundle(accessToken, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete bundle.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Bundles
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        &quot;Buy N eligible items for a fixed total.&quot; A bundle can never
        increase the payable total — the backend enforces that, not this UI.
      </p>

      {isLoading && <LoadingRow label="Loading bundles…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 flex flex-col gap-3">
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-4"
            >
              <div>
                <p className="font-semibold text-ink">{bundle.name}</p>
                <p className="text-sm text-muted-foreground">
                  Fixed total: {formatPrice(bundle.fixedTotal, bundle.currency)} ·{" "}
                  {bundle.eligibleVariants.length} eligible variant(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleToggleEnabled(bundle)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    bundle.isEnabled
                      ? "bg-green-100 text-green-800"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  {bundle.isEnabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDelete(bundle.id)}
                  className="text-sm text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {bundles.length === 0 && (
            <p className="text-muted-foreground">No bundles yet.</p>
          )}
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New bundle</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <input
          required
          placeholder="Bundle name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="number"
          min={1}
          placeholder="Fixed total (minor units)"
          value={fixedTotal}
          onChange={(e) => setFixedTotal(e.target.value)}
          className={`${inputClass} w-56`}
        />
        <input
          required
          placeholder="Variant ids, comma-separated (min 2)"
          value={variantIds}
          onChange={(e) => setVariantIds(e.target.value)}
          className={`${inputClass} w-72`}
        />
        <button type="submit" disabled={isBusy} className={buttonClass}>
          Create
        </button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        New bundles are created disabled — enable one only once you&apos;ve
        confirmed the variant ids and fixed total are correct. Currency is
        fixed to EGP here.
      </p>
    </div>
  );
}
