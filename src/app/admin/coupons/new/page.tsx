"use client";

import Link from "next/link";
import { CouponEditor } from "@/components/admin/coupons/CouponEditor";
import { linkButtonClass } from "@/components/admin/admin-styles";

export default function NewCouponPage() {
  return (
    <div className="max-w-6xl">
      <Link href="/admin/coupons" className={linkButtonClass}>
        ← All coupons
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-ink">
        Create coupon
      </h1>
      <CouponEditor coupon={null} />
    </div>
  );
}
