"use client";

import Link from "next/link";
import { linkButtonClass } from "@/components/admin/admin-styles";
import { ShippingZoneEditor } from "@/components/admin/shipping/ShippingZoneEditor";

export default function NewShippingZonePage() {
  return (
    <div className="max-w-6xl">
      <Link href="/admin/shipping" className={linkButtonClass}>
        ← All shipping zones
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-ink">
        Create zone
      </h1>
      <ShippingZoneEditor zone={null} />
    </div>
  );
}
