"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import { primaryButtonClass } from "@/components/admin/admin-styles";
import { ShippingZoneCard } from "@/components/admin/shipping/ShippingZoneCard";
import type { ShippingRate, ShippingZone } from "@/lib/admin/types";

export default function AdminShippingPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listShippingZones(token))
      .then((result) => {
        setZones(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load shipping zones."),
      )
      .finally(() => setIsLoading(false));
  }, [accessToken, authorizedFetch]);

  useEffect(load, [load]);

  async function handleToggleZone(zone: ShippingZone) {
    setBusyKey(zone.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) =>
        adminClient.updateShippingZone(token, zone.id, { isActive: !zone.isActive }),
      );
      // The PATCH response has no rates; keep the ones we already have.
      setZones((prev) =>
        prev.map((z) => (z.id === zone.id ? { ...z, isActive: updated.isActive } : z)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the zone.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleRate(zone: ShippingZone, rate: ShippingRate) {
    setBusyKey(rate.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) =>
        adminClient.updateShippingRate(token, zone.id, rate.id, { isActive: !rate.isActive }),
      );
      setZones((prev) =>
        prev.map((z) =>
          z.id === zone.id
            ? { ...z, rates: z.rates.map((r) => (r.id === rate.id ? updated : r)) }
            : z,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the rate.");
    } finally {
      setBusyKey(null);
    }
  }

  const createButton = (
    <Link href="/admin/shipping/new" className={`${primaryButtonClass} inline-block`}>
      + Create zone
    </Link>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-ink">Shipping</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage delivery zones, rates and pricing.
          </p>
        </div>
        {createButton}
      </div>

      {isLoading && <LoadingRow label="Loading shipping zones…" />}
      {error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {error}
        </p>
      )}

      {!isLoading && zones.length === 0 && !error && (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold text-ink">No shipping zones yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a zone for the countries you deliver to, then add its shipping rates.
          </p>
          <div className="mt-4">{createButton}</div>
        </div>
      )}

      {zones.length > 0 && (
        <div className="mt-6 flex flex-col gap-5">
          {zones.map((zone) => (
            <ShippingZoneCard
              key={zone.id}
              zone={zone}
              busyKey={busyKey}
              onToggleZone={handleToggleZone}
              onToggleRate={handleToggleRate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
