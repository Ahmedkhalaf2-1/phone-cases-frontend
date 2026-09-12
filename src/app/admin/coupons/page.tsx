"use client";

import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { AdminCoupon, CouponType } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminCouponsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const formId = useId();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENTAGE");
  // Percentage is a plain 1-100 integer; Fixed is money, so it goes
  // through MoneyInput and stays in minor units (piastres) end to end.
  const [percentValue, setPercentValue] = useState("");
  const [fixedValueMinor, setFixedValueMinor] = useState<number | null>(null);
  const [minSpend, setMinSpend] = useState<number | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCoupons(token))
      .then((result) => {
        setCoupons(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load coupons."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const value = type === "PERCENTAGE" ? Number(percentValue) : fixedValueMinor;
    if (value === null || !Number.isFinite(value) || value <= 0) {
      setError(
        type === "PERCENTAGE" ? "Enter a percentage between 1 and 100." : "Enter the fixed discount amount.",
      );
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createCoupon(token, {
          code: code.toUpperCase(),
          type,
          value,
          minSpend: minSpend ?? undefined,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          usageLimit: usageLimit ? Number(usageLimit) : undefined,
        }),
      );
      setCode("");
      setPercentValue("");
      setFixedValueMinor(null);
      setMinSpend(null);
      setStartsAt("");
      setExpiresAt("");
      setUsageLimit("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create coupon.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleActive(coupon: AdminCoupon) {
    if (!accessToken) return;
    try {
      await authorizedFetch((token) =>
        adminClient.updateCoupon(token, coupon.id, { isActive: !coupon.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update coupon.");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Coupons
      </h1>

      {isLoading && <LoadingRow label="Loading coupons…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">Code</th>
                <th className="p-2 text-start">Type</th>
                <th className="p-2 text-start">Value</th>
                <th className="p-2 text-start">Min spend</th>
                <th className="p-2 text-start">Valid</th>
                <th className="p-2 text-start">Used</th>
                <th className="p-2 text-start">Active</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border transition-colors hover:bg-surface">
                  <td className="p-2 font-semibold">{coupon.code}</td>
                  <td className="p-2">{coupon.type}</td>
                  <td className="p-2">
                    {coupon.type === "PERCENTAGE"
                      ? `${coupon.value}%`
                      : formatPrice(coupon.value, "EGP")}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {coupon.minSpend ? formatPrice(coupon.minSpend, "EGP") : "—"}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString() : "…"}
                    {" – "}
                    {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "no end"}
                  </td>
                  <td className="p-2">
                    {coupon.usageCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(coupon)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        coupon.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {coupon.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No coupons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New coupon</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-2xl flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <label htmlFor={`${formId}-code`} className="sr-only">
            Code
          </label>
          <input
            id={`${formId}-code`}
            required
            placeholder="CODE"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} uppercase`}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CouponType)}
            className={inputClass}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </select>
          {type === "PERCENTAGE" ? (
            <input
              required
              type="number"
              min={1}
              max={100}
              placeholder="Percent off (1-100)"
              value={percentValue}
              onChange={(e) => setPercentValue(e.target.value)}
              className={`${inputClass} w-40`}
            />
          ) : (
            <MoneyInput
              label="Discount amount"
              minorUnits={fixedValueMinor}
              onChange={setFixedValueMinor}
              className="w-32"
            />
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <MoneyInput
            label="Minimum spend (optional)"
            minorUnits={minSpend}
            onChange={setMinSpend}
            className="w-40"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-starts`} className="text-sm font-semibold text-ink">
              Starts (optional)
            </label>
            <input
              id={`${formId}-starts`}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-expires`} className="text-sm font-semibold text-ink">
              Expires (optional)
            </label>
            <input
              id={`${formId}-expires`}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-limit`} className="text-sm font-semibold text-ink">
              Usage limit (optional)
            </label>
            <input
              id={`${formId}-limit`}
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              className={`${inputClass} w-32`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="self-start rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isCreating ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
