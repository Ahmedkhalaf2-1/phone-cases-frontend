"use client";

import Link from "next/link";
import { linkButtonClass } from "@/components/admin/admin-styles";
import { formatDiscount, formatMinSpend } from "@/lib/admin/coupon-display";
import { formatDateTime } from "@/lib/admin/datetime";
import type { AdminCoupon } from "@/lib/admin/types";
import { CouponStatusPill } from "./CouponStatusPill";
import { CouponUsage } from "./CouponUsage";

function RowActions({
  coupon,
  busy,
  onToggle,
}: {
  coupon: AdminCoupon;
  busy: boolean;
  onToggle: (coupon: AdminCoupon) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <Link href={`/admin/coupons/${coupon.id}`} className={linkButtonClass}>
        Edit
      </Link>
      <button
        type="button"
        onClick={() => onToggle(coupon)}
        disabled={busy}
        className={linkButtonClass}
      >
        {busy ? "Saving…" : coupon.isActive ? "Disable" : "Enable"}
      </button>
    </div>
  );
}

/** Start and end on their own lines so a date never breaks mid-time. */
function ScheduleText({ coupon }: { coupon: AdminCoupon }) {
  const { startsAt, expiresAt } = coupon;
  if (!startsAt && !expiresAt) return <>No expiry</>;
  return (
    <span className="block whitespace-nowrap">
      {startsAt && <span className="block">{expiresAt ? "" : "From "}{formatDateTime(startsAt)}</span>}
      {expiresAt && (
        <span className="block">
          {startsAt ? "→ " : "Until "}
          {formatDateTime(expiresAt)}
        </span>
      )}
      {startsAt && !expiresAt && <span className="block">No expiry</span>}
    </span>
  );
}

function CodeLink({ coupon }: { coupon: AdminCoupon }) {
  return (
    <Link
      href={`/admin/coupons/${coupon.id}`}
      className="font-mono text-base font-bold tracking-wide text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {coupon.code}
    </Link>
  );
}

/**
 * Table from xl up (the admin sidebar leaves a 7-column table too little
 * room below ~1280px), a card grid below - same data, same actions.
 */
export function CouponList({
  coupons,
  busyId,
  onToggle,
}: {
  coupons: AdminCoupon[];
  busyId: string | null;
  onToggle: (coupon: AdminCoupon) => void;
}) {
  return (
    <>
      <div className="mt-4 hidden overflow-x-auto rounded-3xl border border-border xl:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3 text-start font-semibold">Code</th>
              <th scope="col" className="px-3 py-3 text-start font-semibold">Discount</th>
              <th scope="col" className="px-3 py-3 text-start font-semibold">Minimum spend</th>
              <th scope="col" className="px-3 py-3 text-start font-semibold">Usage</th>
              <th scope="col" className="px-3 py-3 text-start font-semibold">Schedule</th>
              <th scope="col" className="px-3 py-3 text-start font-semibold">Status</th>
              <th scope="col" className="px-3 py-3 text-start font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr
                key={coupon.id}
                className="border-t border-border transition-colors hover:bg-surface"
              >
                <td className="px-3 py-3.5">
                  <CodeLink coupon={coupon} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-ink">
                  {formatDiscount(coupon.type, coupon.value)}
                </td>
                <td className="px-3 py-3.5 text-muted-foreground">
                  {formatMinSpend(coupon.minSpend)}
                </td>
                <td className="px-3 py-3.5">
                  <CouponUsage usageCount={coupon.usageCount} usageLimit={coupon.usageLimit} />
                </td>
                <td className="px-3 py-3.5 text-muted-foreground">
                  <ScheduleText coupon={coupon} />
                </td>
                <td className="px-3 py-3.5">
                  <CouponStatusPill status={coupon.status} />
                </td>
                <td className="px-3 py-3.5">
                  <RowActions coupon={coupon} busy={busyId === coupon.id} onToggle={onToggle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:hidden">
        {coupons.map((coupon) => (
          <li key={coupon.id} className="rounded-3xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CodeLink coupon={coupon} />
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  {formatDiscount(coupon.type, coupon.value)}
                </p>
              </div>
              <CouponStatusPill status={coupon.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Minimum spend
                </dt>
                <dd className="text-ink">{formatMinSpend(coupon.minSpend)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Usage</dt>
                <dd>
                  <CouponUsage usageCount={coupon.usageCount} usageLimit={coupon.usageLimit} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Schedule
                </dt>
                <dd className="text-ink"><ScheduleText coupon={coupon} /></dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-border pt-3">
              <RowActions coupon={coupon} busy={busyId === coupon.id} onToggle={onToggle} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
