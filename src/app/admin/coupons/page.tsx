"use client";

import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminCoupon, CouponType } from "@/lib/admin/types";

export default function AdminCouponsPage() {
  const { accessToken } = useAdminAuth();
  const formId = useId();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function load() {
    if (!accessToken) return;
    adminClient
      .listCoupons(accessToken)
      .then((result) => {
        setCoupons(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load coupons."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsCreating(true);
    setError(null);
    try {
      await adminClient.createCoupon(accessToken, {
        code: code.toUpperCase(),
        type,
        value: Number(value),
      });
      setCode("");
      setValue("");
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
      await adminClient.updateCoupon(accessToken, coupon.id, {
        isActive: !coupon.isActive,
      });
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
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">Code</th>
                <th className="p-2 text-start">Type</th>
                <th className="p-2 text-start">Value</th>
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
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No coupons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New coupon</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <label htmlFor={`${formId}-code`} className="sr-only">
          Code
        </label>
        <input
          id={`${formId}-code`}
          required
          placeholder="CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent uppercase"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CouponType)}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed (minor units)</option>
        </select>
        <input
          required
          type="number"
          min={1}
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-32 rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isCreating ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
