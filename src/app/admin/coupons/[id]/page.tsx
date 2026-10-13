"use client";

import Link from "next/link";
import { use } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient } from "@/lib/admin/admin-client";
import { useRemote } from "@/lib/admin/hooks";
import { LoadingRow } from "@/components/ui/Spinner";
import { linkButtonClass } from "@/components/admin/admin-styles";
import { CouponEditor } from "@/components/admin/coupons/CouponEditor";
import { CouponStatusPill } from "@/components/admin/coupons/CouponStatusPill";

export default function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { authorizedFetch } = useAdminAuth();
  const coupon = useRemote(`coupon|${id}`, () =>
    authorizedFetch((token) => adminClient.getCoupon(token, id)),
  );

  return (
    <div className="max-w-6xl">
      <Link href="/admin/coupons" className={linkButtonClass}>
        ← All coupons
      </Link>
      {coupon.loading && <LoadingRow label="Loading coupon…" />}
      {coupon.error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {coupon.error}
        </p>
      )}
      {coupon.data && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl uppercase tracking-tight text-ink">
              Edit coupon
            </h1>
            <CouponStatusPill status={coupon.data.status} />
          </div>
          <CouponEditor key={coupon.data.id} coupon={coupon.data} />
        </>
      )}
    </div>
  );
}
