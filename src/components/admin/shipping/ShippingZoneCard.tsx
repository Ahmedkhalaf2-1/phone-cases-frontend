"use client";

import Link from "next/link";
import { Switch } from "@/components/admin/form-kit";
import {
  formatDeliveryEstimate,
  formatFreeShipping,
  formatRatePrice,
} from "@/lib/admin/shipping-display";
import type { ShippingRate, ShippingZone } from "@/lib/admin/types";
import { ActiveBadge } from "./ActiveBadge";
import { CountryChips } from "./CountryChips";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const editButton = `rounded-pill border border-border bg-background px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink ${focusRing}`;

function RateRow({
  zone,
  rate,
  busy,
  onToggle,
}: {
  zone: ShippingZone;
  rate: ShippingRate;
  busy: boolean;
  onToggle: (zone: ShippingZone, rate: ShippingRate) => void;
}) {
  const estimate = formatDeliveryEstimate(rate.estimatedDaysMin, rate.estimatedDaysMax);
  const free = formatFreeShipping(rate);
  const live = rate.isActive && zone.isActive;
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 ${live ? "" : "opacity-60"}`}>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M1 5h13v11H1zM14 9h4l3 3v4h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 break-words font-semibold text-ink">
          {rate.nameEn.trim() || "Untitled rate"}
          <span dir="rtl" lang="ar" className="text-sm font-normal text-muted-foreground">
            {rate.nameAr}
          </span>
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span>{estimate ?? "No delivery estimate"}</span>
          {free && <span className="font-semibold text-green-700">{free}</span>}
        </p>
      </div>
      <p className="font-display text-2xl tracking-tight text-ink tabular-nums">{formatRatePrice(rate.price)}</p>
      <div className="flex items-center gap-3">
        <Switch
          checked={rate.isActive}
          disabled={busy}
          onChange={() => onToggle(zone, rate)}
          label={`${rate.nameEn || "Rate"} active`}
        />
        <Link href={`/admin/shipping/zones/${zone.id}/rates/${rate.id}`} className={editButton}>
          Edit
        </Link>
      </div>
    </li>
  );
}

/** One zone and the delivery options (rates) customers can pick in it. */
export function ShippingZoneCard({
  zone,
  busyKey,
  onToggleZone,
  onToggleRate,
}: {
  zone: ShippingZone;
  busyKey: string | null;
  onToggleZone: (zone: ShippingZone) => void;
  onToggleRate: (zone: ShippingZone, rate: ShippingRate) => void;
}) {
  // Same order checkout uses (displayOrder, then price); the API list is unordered.
  const rates = [...zone.rates].sort((a, b) => a.displayOrder - b.displayOrder || a.price - b.price);
  const count = rates.length;
  const addRateHref = `/admin/shipping/zones/${zone.id}/rates/new`;
  return (
    <article className="overflow-hidden rounded-card bg-surface shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
              zone.isActive ? "bg-ink text-white" : "bg-background text-muted-foreground"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words font-display text-2xl uppercase tracking-tight text-ink">
                {zone.nameEn.trim() || "Untitled zone"}
              </h2>
              <ActiveBadge isActive={zone.isActive} />
            </div>
            <p dir="rtl" lang="ar" className="break-words text-start text-sm text-muted-foreground">
              {zone.nameAr}
            </p>
            <div className="mt-2.5">
              <CountryChips codes={zone.countries} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Switch
              checked={zone.isActive}
              disabled={busyKey === zone.id}
              onChange={() => onToggleZone(zone)}
              label={`${zone.nameEn || "Zone"} active`}
            />
            {busyKey === zone.id ? "Saving…" : zone.isActive ? "On" : "Off"}
          </span>
          <Link href={`/admin/shipping/zones/${zone.id}`} className={editButton}>
            Edit zone
          </Link>
        </div>
      </header>

      <div className="border-t border-border px-5 pb-4">
        <div className="flex items-center justify-between gap-3 pt-4">
          <p className="text-sm font-semibold text-ink">
            Delivery options <span className="font-normal text-muted-foreground">· {count}</span>
          </p>
          {count > 0 && (
            <Link href={addRateHref} className="text-sm font-semibold text-accent hover:underline">
              + Add option
            </Link>
          )}
        </div>
        {!zone.isActive && count > 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This zone is off, so none of its delivery options show at checkout.
          </p>
        )}

        {count === 0 ? (
          <div className="mt-3 rounded-2xl bg-background p-6 text-center">
            <p className="font-semibold text-ink">No delivery options yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add at least one so customers in this zone can check out.
            </p>
            <Link
              href={addRateHref}
              className={`mt-4 inline-block rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent ${focusRing}`}
            >
              + Add delivery option
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rates.map((rate) => (
              <RateRow
                key={rate.id}
                zone={zone}
                rate={rate}
                busy={busyKey === rate.id}
                onToggle={onToggleRate}
              />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
