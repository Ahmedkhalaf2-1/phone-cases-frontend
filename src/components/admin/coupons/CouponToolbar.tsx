"use client";

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

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const selectClass = `rounded-pill border border-border bg-background px-4 py-2 text-sm ${focusRing}`;

export function CouponToolbar({
  filters,
  onChange,
  shown,
  total,
  counts,
}: {
  filters: CouponFilters;
  onChange: (next: CouponFilters) => void;
  shown: number;
  total: number;
  /** Coupons per status, for the tab badges. */
  counts: Partial<Record<CouponStatus, number>>;
}) {
  const isFiltered = filters.search !== "" || filters.status !== "ALL" || filters.type !== "ALL";
  const tabs: { value: CouponFilters["status"]; label: string; count: number }[] = [
    { value: "ALL", label: "All", count: total },
    ...COUPON_STATUS_ORDER.filter((s) => counts[s]).map((s) => ({
      value: s,
      label: COUPON_STATUS_STYLE[s].label,
      count: counts[s] ?? 0,
    })),
  ];

  return (
    <div className="mt-5">
      <div role="tablist" aria-label="Coupon status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tabs.map((tab) => {
          const on = filters.status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange({ ...filters, status: tab.value })}
              className={`flex shrink-0 items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-border/60"
              }`}
            >
              {tab.label}
              <span className={`text-xs tabular-nums ${on ? "text-white/75" : "text-muted-foreground"}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground"
          >
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by code"
            aria-label="Search coupons by code"
            className={`w-full rounded-pill border border-border bg-background py-2 ps-10 pe-4 text-sm ${focusRing}`}
          />
        </div>
        <select
          value={filters.type}
          onChange={(e) => onChange({ ...filters, type: e.target.value as CouponFilters["type"] })}
          aria-label="Filter by discount type"
          className={selectClass}
        >
          <option value="ALL">Any discount type</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as CouponSort })}
          aria-label="Sort coupons"
          className={selectClass}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_COUPON_FILTERS, sort: filters.sort })}
            className="px-2 text-sm font-semibold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <span aria-live="polite" className="ms-auto text-sm text-muted-foreground tabular-nums">
          {isFiltered ? `${shown} of ${total}` : `${total} coupon${total === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}
