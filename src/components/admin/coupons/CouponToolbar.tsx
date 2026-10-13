"use client";

import { inputClass, linkButtonClass } from "@/components/admin/admin-styles";
import { COUPON_STATUS_ORDER, COUPON_STATUS_STYLE } from "@/lib/admin/coupon-display";
import type { CouponStatus, CouponType } from "@/lib/admin/types";

export type CouponSort = "newest" | "oldest";

export interface CouponFilters {
  search: string;
  status: CouponStatus | "ALL";
  type: CouponType | "ALL";
  sort: CouponSort;
}

export const DEFAULT_COUPON_FILTERS: CouponFilters = {
  search: "",
  status: "ALL",
  type: "ALL",
  sort: "newest",
};

export function CouponToolbar({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: CouponFilters;
  onChange: (next: CouponFilters) => void;
  shown: number;
  total: number;
}) {
  const isFiltered =
    filters.search !== "" || filters.status !== "ALL" || filters.type !== "ALL";
  const compact = `${inputClass} w-full`;
  return (
    <div className="mt-6">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search by code…"
          aria-label="Search coupons by code"
          className={`${compact} sm:col-span-2 lg:col-span-1`}
        />
        <select
          value={filters.status}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as CouponFilters["status"] })
          }
          aria-label="Filter by status"
          className={compact}
        >
          <option value="ALL">All statuses</option>
          {COUPON_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {COUPON_STATUS_STYLE[status].label}
            </option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => onChange({ ...filters, type: e.target.value as CouponFilters["type"] })}
          aria-label="Filter by discount type"
          className={compact}
        >
          <option value="ALL">All discount types</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as CouponSort })}
          aria-label="Sort coupons"
          className={compact}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {isFiltered ? `${shown} of ${total} coupons` : `${total} coupon${total === 1 ? "" : "s"}`}
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_COUPON_FILTERS, sort: filters.sort })}
            className={linkButtonClass}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
