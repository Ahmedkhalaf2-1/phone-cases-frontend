"use client";

import Link from "next/link";
import { use } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient } from "@/lib/admin/admin-client";
import { useRemote } from "@/lib/admin/hooks";
import { LoadingRow } from "@/components/ui/Spinner";
import { linkButtonClass } from "@/components/admin/admin-styles";
import { ActiveBadge } from "@/components/admin/shipping/ActiveBadge";
import { ShippingZoneEditor } from "@/components/admin/shipping/ShippingZoneEditor";

export default function EditShippingZonePage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = use(params);
  const { authorizedFetch } = useAdminAuth();
  const zone = useRemote(`zone|${zoneId}`, () =>
    authorizedFetch((token) => adminClient.getShippingZone(token, zoneId)),
  );

  return (
    <div className="max-w-6xl">
      <Link href="/admin/shipping" className={linkButtonClass}>
        ← All shipping zones
      </Link>
      {zone.loading && <LoadingRow label="Loading zone…" />}
      {zone.error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {zone.error}
        </p>
      )}
      {zone.data && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl uppercase tracking-tight text-ink">
              Edit zone
            </h1>
            <ActiveBadge isActive={zone.data.isActive} />
          </div>
          <ShippingZoneEditor key={zone.data.id} zone={zone.data} />
        </>
      )}
    </div>
  );
}
