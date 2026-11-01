"use client";

import Link from "next/link";
import { useState } from "react";
import { Switch } from "@/components/admin/form-kit";
import { formatMinSpend } from "@/lib/admin/coupon-display";
import { formatEgp } from "@/lib/admin/money";
import { formatDateTime } from "@/lib/admin/datetime";
import type { AdminCoupon } from "@/lib/admin/types";
import { CouponStatusPill } from "./CouponStatusPill";
import { CouponUsage } from "./CouponUsage";

/** Start and end on their own lines so a date never breaks mid-time. */
function ScheduleText({ coupon }: { coupon: AdminCoupon }) {
  const { startsAt, expiresAt } = coupon;
  if (!startsAt && !expiresAt) return <>No expiry</>;
  if (startsAt && expiresAt) {
    return (
      <>
        {formatDateTime(startsAt)} → {formatDateTime(expiresAt)}
      </>
    );
  }
  return startsAt ? <>From {formatDateTime(startsAt)}</> : <>Until {formatDateTime(expiresAt!)}</>;
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(code)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      aria-label={`Copy ${code}`}
      title="Copy code"
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="size-4 text-green-700">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="size-4">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

/** Ticket-style cards: the discount on the stub, details and actions on the body. */
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
    <ul className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {coupons.map((coupon) => {
        const muted = coupon.status !== "ACTIVE" && coupon.status !== "SCHEDULED";
        return (
          <li key={coupon.id} className="flex overflow-hidden rounded-card bg-surface shadow-card">
            {/* Stub */}
            <div
              className={`relative flex w-28 shrink-0 flex-col items-center justify-center border-e-2 border-dashed border-surface px-3 py-5 text-center sm:w-32 ${
                muted ? "bg-muted-foreground/70 text-white" : "bg-ink text-white"
              }`}
            >
              <span className="font-display text-3xl leading-none break-all">
                {coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatEgp(coupon.value).replace("EGP ", "")}
              </span>
              <span className="mt-1 text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">
                {coupon.type === "PERCENTAGE" ? "off" : "EGP off"}
              </span>
              {/* ticket notches */}
              <span aria-hidden className="absolute -end-2.5 -top-2.5 size-5 rounded-full bg-background" />
              <span aria-hidden className="absolute -end-2.5 -bottom-2.5 size-5 rounded-full bg-background" />
            </div>

            {/* Body */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <Link
                    href={`/admin/coupons/${coupon.id}`}
                    className="truncate font-mono text-base font-bold tracking-wide text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {coupon.code}
                  </Link>
                  <CopyCode code={coupon.code} />
                </div>
                <CouponStatusPill status={coupon.status} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Minimum spend</dt>
                  <dd className="text-ink">{formatMinSpend(coupon.minSpend)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Used</dt>
                  <dd>
                    <CouponUsage usageCount={coupon.usageCount} usageLimit={coupon.usageLimit} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Valid</dt>
                  <dd className="text-ink">
                    <ScheduleText coupon={coupon} />
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Switch
                    checked={coupon.isActive}
                    disabled={busyId === coupon.id}
                    onChange={() => onToggle(coupon)}
                    label={`${coupon.code} enabled`}
                  />
                  {busyId === coupon.id ? "Saving…" : coupon.isActive ? "On" : "Off"}
                </span>
                <Link
                  href={`/admin/coupons/${coupon.id}`}
                  className="rounded-pill border border-border bg-background px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Edit
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
