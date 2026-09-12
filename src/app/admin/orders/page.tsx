"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  AdminOrder,
  FulfillmentStatus,
  PaymentStatus,
} from "@/lib/admin/types";

const FULFILLMENT_VALUES: FulfillmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];
const PAYMENT_VALUES: PaymentStatus[] = [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

export default function AdminOrdersPage() {
  const { accessToken } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    adminClient
      .listOrders(accessToken, {
        fulfillmentStatus: fulfillmentStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        pageSize: 50,
      })
      .then((result) => {
        if (cancelled) return;
        setOrders(result.items);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load orders.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, fulfillmentStatus, paymentStatus]);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Orders
      </h1>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={fulfillmentStatus}
          onChange={(e) => setFulfillmentStatus(e.target.value as FulfillmentStatus | "")}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">All fulfillment statuses</option>
          {FULFILLMENT_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus | "")}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">All payment statuses</option>
          {PAYMENT_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <LoadingRow label="Loading orders…" />}
      {error && <p className="mt-6 text-sm text-accent">{error}</p>}

      {!isLoading && !error && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">#</th>
                <th className="p-2 text-start">Customer</th>
                <th className="p-2 text-start">Fulfillment</th>
                <th className="p-2 text-start">Payment</th>
                <th className="p-2 text-start">Total</th>
                <th className="p-2 text-start">Placed</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border transition-colors hover:bg-surface">
                  <td className="p-2">{order.sequenceNumber}</td>
                  <td className="p-2">{order.customerFullName}</td>
                  <td className="p-2">
                    <StatusBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="p-2">
                    <StatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="p-2">{formatPrice(order.total, order.currency)}</td>
                  <td className="p-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No orders match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
