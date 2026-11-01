"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminOrder, FulfillmentStatus, PaymentStatus } from "@/lib/admin/types";

const FULFILLMENT_VALUES: FulfillmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];
const PAYMENT_VALUES: PaymentStatus[] = ["UNPAID", "PENDING", "PAID", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"];

const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Failed",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
};
const METHOD_LABEL: Record<AdminOrder["paymentMethod"], string> = {
  CASH_ON_DELIVERY: "Cash on delivery",
  INSTAPAY_MANUAL: "InstaPay",
};

const PAGE_SIZE = 50;
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function exactTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ fulfillment?: string; payment?: string }>;
}) {
  // ?fulfillment=PENDING / ?payment=UNPAID preselect a filter (dashboard links).
  const initial = use(searchParams);
  const router = useRouter();
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus | "">(
    () => FULFILLMENT_VALUES.find((v) => v === initial.fulfillment) ?? "",
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">(
    () => PAYMENT_VALUES.find((v) => v === initial.payment) ?? "",
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Partial<Record<FulfillmentStatus | "ALL", number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Per-status counts for the tabs: one tiny request each.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const count = (status?: FulfillmentStatus) =>
      authorizedFetch((token) =>
        adminClient.listOrders(token, { fulfillmentStatus: status, page: 1, pageSize: 1 }),
      ).then((r) => r.meta.totalItems);
    Promise.all([count(), ...FULFILLMENT_VALUES.map((s) => count(s))])
      .then(([all, ...rest]) => {
        if (cancelled) return;
        setCounts({ ALL: all, ...Object.fromEntries(FULFILLMENT_VALUES.map((s, i) => [s, rest[i]])) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, authorizedFetch, reloadKey]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    authorizedFetch((token) =>
      adminClient.listOrders(token, {
        fulfillmentStatus: fulfillmentStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    )
      .then((result) => {
        if (cancelled) return;
        setOrders(result.items);
        setMeta({ totalItems: result.meta.totalItems, totalPages: result.meta.totalPages });
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
  }, [accessToken, authorizedFetch, fulfillmentStatus, paymentStatus, page, reloadKey]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    if (!q) return orders;
    const digits = q.replace(/\s/g, "");
    return orders.filter(
      (o) =>
        String(o.sequenceNumber) === q ||
        o.customerFullName.toLowerCase().includes(q) ||
        o.customerPhone.replace(/\s/g, "").includes(digits) ||
        (o.customerEmail ?? "").toLowerCase().includes(q) ||
        o.shippingCity.toLowerCase().includes(q),
    );
  }, [orders, search]);

  // Every filter change shows the loading state and starts from page 1.
  function update(change: () => void) {
    setIsLoading(true);
    change();
  }

  const tabs: { value: FulfillmentStatus | ""; label: string; count?: number }[] = [
    { value: "", label: "All", count: counts.ALL },
    ...FULFILLMENT_VALUES.map((s) => ({ value: s, label: FULFILLMENT_LABEL[s], count: counts[s] })),
  ];
  const firstShown = meta && meta.totalItems > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = meta ? Math.min(page * PAGE_SIZE, meta.totalItems) : 0;
  const hasFilters = Boolean(fulfillmentStatus || paymentStatus || search);

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.ALL !== undefined ? `${counts.ALL.toLocaleString("en-US")} orders in total` : " "}
          </p>
        </div>
        <button
          type="button"
          onClick={() => update(() => setReloadKey((k) => k + 1))}
          aria-label="Refresh"
          title="Refresh"
          className={`flex size-10 items-center justify-center rounded-pill border border-border bg-background text-ink transition-colors hover:border-ink ${focusRing}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`size-4 ${isLoading ? "animate-spin" : ""}`}
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5" />
          </svg>
        </button>
      </header>

      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Fulfillment status"
        className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {tabs.map((tab) => {
          const on = tab.value === fulfillmentStatus;
          return (
            <button
              key={tab.value || "all"}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() =>
                update(() => {
                  setFulfillmentStatus(tab.value);
                  setPage(1);
                })
              }
              className={`flex shrink-0 items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-border/60"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    on
                      ? "bg-white/20 text-white"
                      : tab.value === "PENDING" && tab.count > 0
                        ? "bg-amber-100 text-amber-800"
                        : "text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + payment filter */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground"
          >
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by #, name, phone or city"
            aria-label="Search orders on this page"
            className={`w-full rounded-pill border border-border bg-background py-2 ps-10 pe-4 text-sm ${focusRing}`}
          />
        </div>
        <select
          value={paymentStatus}
          aria-label="Payment status"
          onChange={(e) =>
            update(() => {
              setPaymentStatus(e.target.value as PaymentStatus | "");
              setPage(1);
            })
          }
          className={`rounded-pill border bg-background px-4 py-2 text-sm ${focusRing} ${
            paymentStatus ? "border-ink font-semibold text-ink" : "border-border"
          }`}
        >
          <option value="">Any payment</option>
          {PAYMENT_VALUES.map((v) => (
            <option key={v} value={v}>
              {PAYMENT_LABEL[v]}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              if (fulfillmentStatus || paymentStatus || page !== 1) {
                update(() => {
                  setFulfillmentStatus("");
                  setPaymentStatus("");
                  setPage(1);
                });
              }
            }}
            className="px-2 text-sm font-semibold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!error && (
        <section className="mt-4 overflow-hidden rounded-card bg-surface shadow-card">
          {isLoading && orders.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-background" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-ink">No orders found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Nothing on this page matches your search." : "No orders match these filters."}
              </p>
            </div>
          ) : (
            <div className={`transition-opacity ${isLoading ? "opacity-60" : ""}`}>
              {/* Table on md+ */}
              <table className="hidden w-full border-collapse text-sm md:table">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-start font-semibold">Order</th>
                    <th className="px-3 py-3 text-start font-semibold">Customer</th>
                    <th className="px-3 py-3 text-start font-semibold">Items</th>
                    <th className="px-3 py-3 text-start font-semibold">Status</th>
                    <th className="px-4 py-3 text-end font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-background"
                    >
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`font-semibold text-ink group-hover:text-accent ${focusRing}`}
                        >
                          #{order.sequenceNumber}
                        </Link>
                        <span
                          className="block text-xs whitespace-nowrap text-muted-foreground"
                          title={exactTime(order.createdAt)}
                        >
                          {relativeTime(order.createdAt)}
                        </span>
                      </td>
                      <td className="max-w-52 px-3 py-3 align-top">
                        <span className="block truncate text-ink">{order.customerFullName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          <bdi>{order.customerPhone}</bdi> · {order.shippingCity}
                        </span>
                      </td>
                      <td className="max-w-64 px-3 py-3 align-top">
                        <ItemsCell order={order} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge status={order.fulfillmentStatus} />
                          <StatusBadge status={order.paymentStatus} />
                        </div>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
                          {order.latePaymentFlaggedAt && <span className="text-amber-700"> · late payment</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end align-top font-semibold whitespace-nowrap text-ink tabular-nums">
                        {formatPrice(order.total, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Cards below md */}
              <ul className="divide-y divide-border md:hidden">
                {visible.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="block px-4 py-3 active:bg-background">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <span className="font-semibold text-ink">#{order.sequenceNumber}</span>{" "}
                          <span className="text-ink">{order.customerFullName}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-ink tabular-nums">
                          {formatPrice(order.total, order.currency)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm">
                        <ItemsCell order={order} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={order.fulfillmentStatus} />
                        <StatusBadge status={order.paymentStatus} />
                        <span className="text-xs text-muted-foreground">{relativeTime(order.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalItems > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {firstShown}–{lastShown} of {meta.totalItems.toLocaleString("en-US")}
              </span>
              {meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || isLoading}
                    onClick={() => update(() => setPage((p) => p - 1))}
                    className={`rounded-pill border border-border bg-background px-3.5 py-1.5 font-semibold text-ink enabled:hover:border-ink disabled:opacity-40 ${focusRing}`}
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {page} / {meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= meta.totalPages || isLoading}
                    onClick={() => update(() => setPage((p) => p + 1))}
                    className={`rounded-pill border border-border bg-background px-3.5 py-1.5 font-semibold text-ink enabled:hover:border-ink disabled:opacity-40 ${focusRing}`}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ItemsCell({ order }: { order: AdminOrder }) {
  const items = order.items ?? [];
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isPersonalized = items.some((item) => item.customDesign);
  return (
    <>
      <span className="block truncate text-ink">
        {items[0].productNameEn}
        {items.length > 1 && <span className="text-muted-foreground"> +{items.length - 1} more</span>}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {itemCount} item{itemCount === 1 ? "" : "s"}
        {isPersonalized && (
          <span className="rounded-full bg-accent-wash px-1.5 py-px text-[11px] font-semibold text-ink">
            Personalized
          </span>
        )}
        {order.customerNote && (
          <span
            className="rounded-full bg-background px-1.5 py-px text-[11px] font-semibold text-ink"
            title={order.customerNote}
          >
            Note
          </span>
        )}
      </span>
    </>
  );
}
