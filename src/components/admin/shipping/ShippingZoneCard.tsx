"use client";

import Link from "next/link";
import { linkButtonClass } from "@/components/admin/admin-styles";

/** Text actions with a >=40px hit area so they are easy to tap on a phone. */
const actionClass = `${linkButtonClass} inline-flex min-h-10 items-center`;
import {
  formatDeliveryEstimate,
  formatFreeShipping,
  formatRatePrice,
} from "@/lib/admin/shipping-display";
import type { ShippingRate, ShippingZone } from "@/lib/admin/types";
import { ActiveBadge } from "./ActiveBadge";
import { CountryChips } from "./CountryChips";

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
  return (
    <li className="relative ps-6 before:absolute before:start-0 before:top-8 before:h-px before:w-5 before:bg-border">
      <div
        className={`rounded-2xl border border-border bg-background p-4 ${
          rate.isActive && zone.isActive ? "" : "opacity-75"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words font-semibold text-ink">
                {rate.nameEn.trim() || "Untitled rate"}
              </p>
              <ActiveBadge isActive={rate.isActive} />
            </div>
            <p dir="rtl" lang="ar" className="mt-0.5 break-words text-start text-sm text-muted-foreground">
              {rate.nameAr}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{estimate ?? "No delivery estimate"}</span>
              {free && <span className="font-semibold text-ink">{free}</span>}
            </div>
          </div>
          <p className="font-display text-xl tracking-tight text-ink">
            {formatRatePrice(rate.price)}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-5 border-t border-border pt-1">
          <Link
            href={`/admin/shipping/zones/${zone.id}/rates/${rate.id}`}
            className={actionClass}
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => onToggle(zone, rate)}
            disabled={busy}
            className={actionClass}
          >
            {busy ? "Saving…" : rate.isActive ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    </li>
  );
}

/** One zone and its rates, drawn as a tree so ownership is obvious. */
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
  const rates = [...zone.rates].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.price - b.price,
  );
  const count = rates.length;
  return (
    <article className="overflow-hidden rounded-3xl border border-border">
      <header className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words font-display text-xl uppercase tracking-tight text-ink">
              {zone.nameEn.trim() || "Untitled zone"}
            </h2>
            <ActiveBadge isActive={zone.isActive} />
          </div>
          <p dir="rtl" lang="ar" className="mt-0.5 break-words text-start text-sm text-muted-foreground">
            {zone.nameAr}
          </p>
          <div className="mt-3">
            <CountryChips codes={zone.countries} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/admin/shipping/zones/${zone.id}`} className={actionClass}>
            Edit zone
          </Link>
          <button
            type="button"
            onClick={() => onToggleZone(zone)}
            disabled={busyKey === zone.id}
            className={actionClass}
          >
            {busyKey === zone.id ? "Saving…" : zone.isActive ? "Disable" : "Enable"}
          </button>
        </div>
      </header>

      <div className="border-t border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {count} shipping rate{count === 1 ? "" : "s"}
        </p>
        {!zone.isActive && count > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            This zone is inactive, so none of its rates are offered at checkout.
          </p>
        )}

        {count === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-background p-6 text-center">
            <p className="font-semibold text-ink">No shipping rates yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a rate to make delivery available in this zone.
            </p>
            <Link
              href={`/admin/shipping/zones/${zone.id}/rates/new`}
              className="mt-4 inline-block rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              + Add shipping rate
            </Link>
          </div>
        ) : (
          <ul className="mt-3 ms-2 flex flex-col gap-3 border-s border-border">
            {rates.map((rate) => (
              <RateRow
                key={rate.id}
                zone={zone}
                rate={rate}
                busy={busyKey === rate.id}
                onToggle={onToggleRate}
              />
            ))}
            <li className="relative ps-6 before:absolute before:start-0 before:top-5 before:h-px before:w-5 before:bg-border">
              <Link
                href={`/admin/shipping/zones/${zone.id}/rates/new`}
                className="inline-flex min-h-10 items-center rounded-pill border border-dashed border-border bg-background px-4 text-sm font-semibold text-ink transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                + Add shipping rate
              </Link>
            </li>
          </ul>
        )}
      </div>
    </article>
  );
}
