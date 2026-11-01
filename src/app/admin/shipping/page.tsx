"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-tight text-ink">Shipping</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Where you deliver and what it costs."
              : `${zones.filter((z) => z.isActive).length} of ${zones.length} zones on · ${zones.reduce(
                  (sum, z) => sum + z.rates.filter((r) => r.isActive).length,
                  0,
                )} delivery options live`}
          </p>
        </div>
        {createButton}
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading && <div aria-hidden className="mt-6 h-56 animate-pulse rounded-card bg-surface" />}

      {!isLoading && zones.length === 0 && !error && (
        <div className="mt-6 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">No shipping zones yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a zone for the countries you deliver to, then add its shipping rates.
          </p>
          <div className="mt-4">{createButton}</div>
        </div>
      )}

      {zones.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
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
