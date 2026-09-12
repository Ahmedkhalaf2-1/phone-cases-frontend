"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";

export default function AdminDashboardPage() {
  const { staff } = useAdminAuth();

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Dashboard
      </h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {staff?.fullName} ({staff?.role}).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/orders"
          className="rounded-sm border border-border p-5 hover:border-accent"
        >
          <h2 className="font-semibold text-ink">Orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review orders, update status, handle receipts.
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-sm border border-border p-5 hover:border-accent"
        >
          <h2 className="font-semibold text-ink">Products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse catalog products and variants.
          </p>
        </Link>
        <Link
          href="/admin/stock"
          className="rounded-sm border border-border p-5 hover:border-accent"
        >
          <h2 className="font-semibold text-ink">Stock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust stock item quantities.
          </p>
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        This is a lean first pass on the admin panel — see
        docs/FRONTEND_PROGRESS.md for what&apos;s implemented vs. still
        needed (product/variant creation, media, coupons/bundles, refunds
        UI, homepage/pages CMS).
      </p>
    </div>
  );
}
