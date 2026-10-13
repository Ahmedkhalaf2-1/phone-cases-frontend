"use client";

import Link from "next/link";
import { use } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient } from "@/lib/admin/admin-client";
import { useRemote } from "@/lib/admin/hooks";
import { LoadingRow } from "@/components/ui/Spinner";
import { linkButtonClass } from "@/components/admin/admin-styles";
import { ActiveBadge } from "@/components/admin/shipping/ActiveBadge";
import { ShippingRateEditor } from "@/components/admin/shipping/ShippingRateEditor";

export default function EditShippingRatePage({
  params,
}: {
  params: Promise<{ zoneId: string; rateId: string }>;
}) {
  const { zoneId, rateId } = use(params);
  const { authorizedFetch } = useAdminAuth();
  // The API has no single-rate read; the zone response carries its rates.
  const zone = useRemote(`zone|${zoneId}`, () =>
    authorizedFetch((token) => adminClient.getShippingZone(token, zoneId)),
  );
  const rate = zone.data?.rates.find((r) => r.id === rateId) ?? null;

  return (
    <div className="max-w-6xl">
      <Link href="/admin/shipping" className={linkButtonClass}>
        ← All shipping zones
      </Link>
      {zone.loading && <LoadingRow label="Loading rate…" />}
      {zone.error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {zone.error}
        </p>
      )}
      {zone.data && !rate && (
        <p role="alert" className="mt-4 text-sm text-accent">
          This shipping rate no longer exists in {zone.data.nameEn}.
        </p>
      )}
      {zone.data && rate && (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {zone.data.nameEn}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl uppercase tracking-tight text-ink">
              Edit shipping rate
            </h1>
            <ActiveBadge isActive={rate.isActive} />
          </div>
          <ShippingRateEditor key={rate.id} zone={zone.data} rate={rate} />
        </>
      )}
    </div>
  );
}
