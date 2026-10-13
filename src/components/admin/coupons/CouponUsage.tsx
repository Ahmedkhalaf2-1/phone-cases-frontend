import { formatUsage, usagePercent } from "@/lib/admin/coupon-display";

/** "5 / 100" with a subtle progress bar when a limit exists; "1 used" otherwise. */
export function CouponUsage({
  usageCount,
  usageLimit,
}: {
  usageCount: number;
  usageLimit: number | null;
}) {
  const percent = usagePercent(usageCount, usageLimit);
  return (
    <div className="min-w-24">
      <p className="text-sm text-ink">{formatUsage(usageCount, usageLimit)}</p>
      {percent !== null && (
        <div
          role="progressbar"
          aria-label="Coupon usage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border"
        >
          <div
            className={`h-full rounded-full ${percent >= 100 ? "bg-accent" : "bg-ink"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
