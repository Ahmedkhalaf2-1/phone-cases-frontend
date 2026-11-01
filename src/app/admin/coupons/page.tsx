"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { primaryButtonClass } from "@/components/admin/admin-styles";
import { CouponList } from "@/components/admin/coupons/CouponList";
import {
  CouponToolbar,
  DEFAULT_COUPON_FILTERS,
  type CouponFilters,
} from "@/components/admin/coupons/CouponToolbar";
import { matchesSearch } from "@/lib/admin/coupon-display";
import type { AdminCoupon, CouponStatus } from "@/lib/admin/types";

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

  const counts = useMemo(() => {
    const result: Partial<Record<CouponStatus, number>> = {};
    for (const c of coupons) result[c.status] = (result[c.status] ?? 0) + 1;
    return result;
  }, [coupons]);

  const createButton = (
    <Link href="/admin/coupons/new" className={`${primaryButtonClass} inline-block`}>
      + Create coupon
    </Link>
  );

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-tight text-ink">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Discount codes customers type at checkout."
              : `${counts.ACTIVE ?? 0} active · ${coupons.length} in total`}
          </p>
        </div>
        {createButton}
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading && (
        <ul aria-hidden className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-44 animate-pulse rounded-card bg-surface" />
          ))}
        </ul>
      )}

      {!isLoading && coupons.length === 0 && !error && (
        <div className="mt-6 rounded-card bg-surface p-10 text-center shadow-card">
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
            counts={counts}
          />
          {visible.length === 0 ? (
            <div className="mt-4 rounded-card bg-surface p-10 text-center text-sm text-muted-foreground shadow-card">
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
