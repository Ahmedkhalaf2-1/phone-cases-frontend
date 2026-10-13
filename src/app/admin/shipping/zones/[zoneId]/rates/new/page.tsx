"use client";

import Link from "next/link";
import { use } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient } from "@/lib/admin/admin-client";
import { useRemote } from "@/lib/admin/hooks";
import { LoadingRow } from "@/components/ui/Spinner";
import { linkButtonClass } from "@/components/admin/admin-styles";
import { ShippingRateEditor } from "@/components/admin/shipping/ShippingRateEditor";

export default function NewShippingRatePage({
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
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {zone.data.nameEn}
          </p>
          <h1 className="font-display text-3xl uppercase tracking-tight text-ink">
            Add shipping rate
          </h1>
          <ShippingRateEditor key={zone.data.id} zone={zone.data} rate={null} />
        </>
      )}
    </div>
  );
}
