"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import { primaryButtonClass } from "@/components/admin/admin-styles";
import { CouponList } from "@/components/admin/coupons/CouponList";
import {
  CouponToolbar,
  DEFAULT_COUPON_FILTERS,
  type CouponFilters,
} from "@/components/admin/coupons/CouponToolbar";
import { matchesSearch } from "@/lib/admin/coupon-display";
import type { AdminCoupon } from "@/lib/admin/types";

export default function AdminCouponsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CouponFilters>(DEFAULT_COUPON_FILTERS);

  const load = useCallback(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCoupons(token))
      .then((result) => {
        setCoupons(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load coupons."),
      )
      .finally(() => setIsLoading(false));
  }, [accessToken, authorizedFetch]);

  useEffect(load, [load]);

  async function handleToggle(coupon: AdminCoupon) {
    setBusyId(coupon.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) =>
        adminClient.updateCoupon(token, coupon.id, { isActive: !coupon.isActive }),
      );
      // The server returns the recomputed status; swap the row in place.
      setCoupons((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update coupon.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    const filtered = coupons.filter(
      (c) =>
        matchesSearch(c, filters.search) &&
        (filters.status === "ALL" || c.status === filters.status) &&
        (filters.type === "ALL" || c.type === filters.type),
    );
    const direction = filters.sort === "newest" ? -1 : 1;
    return [...filtered].sort(
      (a, b) => direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    );
  }, [coupons, filters]);

  const createButton = (
    <Link href="/admin/coupons/new" className={`${primaryButtonClass} inline-block`}>
      + Create coupon
    </Link>
  );

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-ink">Coupons</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create and manage discount codes.
          </p>
        </div>
        {createButton}
      </div>

      {isLoading && <LoadingRow label="Loading coupons…" />}
      {error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {error}
        </p>
      )}

      {!isLoading && coupons.length === 0 && !error && (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold text-ink">No coupons yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a code like WELCOME10 to give customers a discount.
          </p>
          <div className="mt-4">{createButton}</div>
        </div>
      )}

      {!isLoading && coupons.length > 0 && (
        <>
          <CouponToolbar
            filters={filters}
            onChange={setFilters}
            shown={visible.length}
            total={coupons.length}
          />
          {visible.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No coupons match these filters.
            </div>
          ) : (
            <CouponList coupons={visible} busyId={busyId} onToggle={handleToggle} />
          )}
        </>
      )}
    </div>
  );
}
