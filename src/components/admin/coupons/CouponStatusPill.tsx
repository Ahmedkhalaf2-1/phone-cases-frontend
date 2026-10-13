import { COUPON_STATUS_STYLE } from "@/lib/admin/coupon-display";
import type { CouponStatus } from "@/lib/admin/types";

/** Renders the server-derived coupon status; never recomputes it. */
export function CouponStatusPill({ status }: { status: CouponStatus }) {
  const style = COUPON_STATUS_STYLE[status];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${style.className}`}
    >
      {style.label}
    </span>
  );
}
