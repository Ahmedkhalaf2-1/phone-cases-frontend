"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { ShippingRate, ShippingZone } from "@/lib/admin/types";

const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface ZoneEditState {
  nameEn: string;
  nameAr: string;
  countries: string;
}

interface RateEditState {
  nameEn: string;
  nameAr: string;
  price: number | null;
  freeShippingThreshold: number | null;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
}

export default function AdminShippingPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [countries, setCountries] = useState("");
  const [isCreatingZone, setIsCreatingZone] = useState(false);

  const [rateZoneId, setRateZoneId] = useState("");
  const [rateNameEn, setRateNameEn] = useState("");
  const [rateNameAr, setRateNameAr] = useState("");
  const [ratePrice, setRatePrice] = useState<number | null>(null);
  const [isCreatingRate, setIsCreatingRate] = useState(false);

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneEdit, setZoneEdit] = useState<ZoneEditState>({ nameEn: "", nameAr: "", countries: "" });
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateEdit, setRateEdit] = useState<RateEditState>({
    nameEn: "",
    nameAr: "",
    price: null,
    freeShippingThreshold: null,
    estimatedDaysMin: "",
    estimatedDaysMax: "",
  });

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listShippingZones(token))
      .then((result) => {
        setZones(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load shipping zones."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  async function handleCreateZone(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsCreatingZone(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createShippingZone(token, {
          nameEn,
          nameAr,
          countries: countries
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
        }),
      );
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
    if (ratePrice === null) {
      setError("Enter the shipping rate's price.");
      return;
    }
    setIsCreatingRate(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createShippingRate(token, rateZoneId, {
          nameEn: rateNameEn,
          nameAr: rateNameAr,
          price: ratePrice,
        }),
      );
      setRateNameEn("");
      setRateNameAr("");
      setRatePrice(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create rate.");
    } finally {
      setIsCreatingRate(false);
    }
  }

  function startEditingZone(zone: ShippingZone) {
    setEditingZoneId(zone.id);
    setZoneEdit({ nameEn: zone.nameEn, nameAr: zone.nameAr, countries: zone.countries.join(", ") });
  }

  async function handleSaveZone(event: React.FormEvent, zoneId: string) {
    event.preventDefault();
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateShippingZone(token, zoneId, {
          nameEn: zoneEdit.nameEn,
          nameAr: zoneEdit.nameAr,
          countries: zoneEdit.countries
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
        }),
      );
      setEditingZoneId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save zone.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleZoneActive(zone: ShippingZone) {
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateShippingZone(token, zone.id, { isActive: !zone.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update zone.");
    } finally {
      setIsBusy(false);
    }
  }

  function startEditingRate(rate: ShippingRate) {
    setEditingRateId(rate.id);
    setRateEdit({
      nameEn: rate.nameEn,
      nameAr: rate.nameAr,
      price: rate.price,
      freeShippingThreshold: rate.freeShippingThreshold,
      estimatedDaysMin: rate.estimatedDaysMin?.toString() ?? "",
      estimatedDaysMax: rate.estimatedDaysMax?.toString() ?? "",
    });
  }

  async function handleSaveRate(event: React.FormEvent, zoneId: string, rateId: string) {
    event.preventDefault();
    if (!accessToken || rateEdit.price === null) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateShippingRate(token, zoneId, rateId, {
          nameEn: rateEdit.nameEn,
          nameAr: rateEdit.nameAr,
          price: rateEdit.price ?? undefined,
          freeShippingThreshold: rateEdit.freeShippingThreshold ?? undefined,
          estimatedDaysMin: rateEdit.estimatedDaysMin ? Number(rateEdit.estimatedDaysMin) : undefined,
          estimatedDaysMax: rateEdit.estimatedDaysMax ? Number(rateEdit.estimatedDaysMax) : undefined,
        }),
      );
      setEditingRateId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save rate.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleRateActive(zoneId: string, rate: ShippingRate) {
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.updateShippingRate(token, zoneId, rate.id, { isActive: !rate.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update rate.");
    } finally {
      setIsBusy(false);
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
            <div key={zone.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {editingZoneId === zone.id ? (
                  <form
                    onSubmit={(e) => handleSaveZone(e, zone.id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      required
                      value={zoneEdit.nameEn}
                      onChange={(e) => setZoneEdit((s) => ({ ...s, nameEn: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      required
                      dir="rtl"
                      value={zoneEdit.nameAr}
                      onChange={(e) => setZoneEdit((s) => ({ ...s, nameAr: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      required
                      placeholder="Countries (comma-separated)"
                      value={zoneEdit.countries}
                      onChange={(e) => setZoneEdit((s) => ({ ...s, countries: e.target.value }))}
                      className={`${inputClass} w-56`}
                    />
                    <button type="submit" disabled={isBusy} className={buttonClass}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingZoneId(null)}
                      className="text-sm font-semibold text-muted-foreground underline underline-offset-4"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <h2 className="font-semibold text-ink">
                    {zone.nameEn} ({zone.countries.join(", ")})
                  </h2>
                )}
                <div className="flex items-center gap-3">
                  {editingZoneId !== zone.id && (
                    <button
                      type="button"
                      onClick={() => startEditingZone(zone)}
                      className="text-xs font-semibold text-accent underline underline-offset-4"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleZoneActive(zone)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 ${
                      zone.isActive ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground"
                    }`}
                  >
                    {zone.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {zone.rates.map((rate) => (
                  <li key={rate.id} className="border-b border-border py-1">
                    {editingRateId === rate.id ? (
                      <form
                        onSubmit={(e) => handleSaveRate(e, zone.id, rate.id)}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input
                          required
                          placeholder="Name (English)"
                          value={rateEdit.nameEn}
                          onChange={(e) => setRateEdit((s) => ({ ...s, nameEn: e.target.value }))}
                          className={inputClass}
                        />
                        <input
                          required
                          dir="rtl"
                          placeholder="الاسم (عربي)"
                          value={rateEdit.nameAr}
                          onChange={(e) => setRateEdit((s) => ({ ...s, nameAr: e.target.value }))}
                          className={inputClass}
                        />
                        <MoneyInput
                          label="Price"
                          minorUnits={rateEdit.price}
                          onChange={(v) => setRateEdit((s) => ({ ...s, price: v }))}
                          className="w-32"
                        />
                        <MoneyInput
                          label="Free shipping over"
                          minorUnits={rateEdit.freeShippingThreshold}
                          onChange={(v) => setRateEdit((s) => ({ ...s, freeShippingThreshold: v }))}
                          className="w-32"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Min days"
                          value={rateEdit.estimatedDaysMin}
                          onChange={(e) => setRateEdit((s) => ({ ...s, estimatedDaysMin: e.target.value }))}
                          className={`${inputClass} w-24`}
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Max days"
                          value={rateEdit.estimatedDaysMax}
                          onChange={(e) => setRateEdit((s) => ({ ...s, estimatedDaysMax: e.target.value }))}
                          className={`${inputClass} w-24`}
                        />
                        <button type="submit" disabled={isBusy} className={buttonClass}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRateId(null)}
                          className="text-sm font-semibold text-muted-foreground underline underline-offset-4"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {rate.nameEn} — {formatPrice(rate.price, rate.currency)}
                          {rate.estimatedDaysMin != null && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({rate.estimatedDaysMin}–{rate.estimatedDaysMax ?? rate.estimatedDaysMin}{" "}
                              days)
                            </span>
                          )}
                          {rate.freeShippingThreshold != null && (
                            <span className="text-muted-foreground">
                              {" "}
                              · free over {formatPrice(rate.freeShippingThreshold, rate.currency)}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEditingRate(rate)}
                            className="text-xs font-semibold text-accent underline underline-offset-4"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleRateActive(zone.id, rate)}
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 ${
                              rate.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-surface text-muted-foreground"
                            }`}
                          >
                            {rate.isActive ? "Active" : "Inactive"}
                          </button>
                        </span>
                      </div>
                    )}
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
        <MoneyInput label="Price" minorUnits={ratePrice} onChange={setRatePrice} className="w-36" />
        <button type="submit" disabled={isCreatingRate} className={buttonClass}>
          {isCreatingRate ? "Creating…" : "Create rate"}
        </button>
      </form>
    </div>
  );
}
