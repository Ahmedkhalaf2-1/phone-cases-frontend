"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import type { ShippingZone } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminShippingPage() {
  const { accessToken } = useAdminAuth();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [countries, setCountries] = useState("");
  const [isCreatingZone, setIsCreatingZone] = useState(false);

  const [rateZoneId, setRateZoneId] = useState("");
  const [rateNameEn, setRateNameEn] = useState("");
  const [rateNameAr, setRateNameAr] = useState("");
  const [ratePrice, setRatePrice] = useState("");
  const [isCreatingRate, setIsCreatingRate] = useState(false);

  function load() {
    if (!accessToken) return;
    adminClient
      .listShippingZones(accessToken)
      .then((result) => {
        setZones(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load shipping zones."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken]);

  async function handleCreateZone(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsCreatingZone(true);
    setError(null);
    try {
      await adminClient.createShippingZone(accessToken, {
        nameEn,
        nameAr,
        countries: countries
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      });
      setNameEn("");
      setNameAr("");
      setCountries("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create zone.");
    } finally {
      setIsCreatingZone(false);
    }
  }

  async function handleCreateRate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !rateZoneId) return;
    setIsCreatingRate(true);
    setError(null);
    try {
      await adminClient.createShippingRate(accessToken, rateZoneId, {
        nameEn: rateNameEn,
        nameAr: rateNameAr,
        price: Number(ratePrice),
      });
      setRateNameEn("");
      setRateNameAr("");
      setRatePrice("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create rate.");
    } finally {
      setIsCreatingRate(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Shipping
      </h1>

      {isLoading && <LoadingRow label="Loading shipping zones…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 flex flex-col gap-6">
          {zones.map((zone) => (
            <div key={zone.id} className="rounded-sm border border-border p-4">
              <h2 className="font-semibold text-ink">
                {zone.nameEn} ({zone.countries.join(", ")})
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {zone.rates.map((rate) => (
                  <li key={rate.id} className="flex justify-between border-b border-border py-1">
                    <span>{rate.nameEn}</span>
                    <span>{formatPrice(rate.price, rate.currency)}</span>
                  </li>
                ))}
                {zone.rates.length === 0 && (
                  <li className="text-muted-foreground">No rates yet.</li>
                )}
              </ul>
            </div>
          ))}
          {zones.length === 0 && (
            <p className="text-muted-foreground">No shipping zones yet.</p>
          )}
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New zone</h2>
      <form onSubmit={handleCreateZone} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <input
          required
          placeholder="Name (English)"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className={inputClass}
        />
        <input
          required
          dir="rtl"
          placeholder="الاسم (عربي)"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className={inputClass}
        />
        <input
          required
          placeholder="Countries (comma-separated, e.g. EG,SA)"
          value={countries}
          onChange={(e) => setCountries(e.target.value)}
          className={`${inputClass} w-64`}
        />
        <button type="submit" disabled={isCreatingZone} className={buttonClass}>
          {isCreatingZone ? "Creating…" : "Create zone"}
        </button>
      </form>

      <h2 className="mt-8 font-semibold text-ink">New rate</h2>
      <form onSubmit={handleCreateRate} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <select
          required
          value={rateZoneId}
          onChange={(e) => setRateZoneId(e.target.value)}
          className={inputClass}
        >
          <option value="">Zone…</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.nameEn}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Name (English)"
          value={rateNameEn}
          onChange={(e) => setRateNameEn(e.target.value)}
          className={inputClass}
        />
        <input
          required
          dir="rtl"
          placeholder="الاسم (عربي)"
          value={rateNameAr}
          onChange={(e) => setRateNameAr(e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="number"
          min={0}
          placeholder="Price (minor units)"
          value={ratePrice}
          onChange={(e) => setRatePrice(e.target.value)}
          className={`${inputClass} w-48`}
        />
        <button type="submit" disabled={isCreatingRate} className={buttonClass}>
          {isCreatingRate ? "Creating…" : "Create rate"}
        </button>
      </form>
    </div>
  );
}
