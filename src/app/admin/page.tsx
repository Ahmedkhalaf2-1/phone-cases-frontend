"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  AdminOrder,
  AdminOrdersResult,
  FulfillmentStatus,
  PaymentStatus,
  StockItem,
} from "@/lib/admin/types";

/**
 * Operational dashboard. Every number comes from existing admin endpoints:
 * - counts: GET /admin/orders filtered by status, reading meta.totalItems
 *   (pageSize=1, so each count is one tiny request);
 * - collected revenue / best sellers / daily chart: every order whose
 *   payment status is PAID or PARTIALLY_REFUNDED, paged through;
 * - recent + personalized orders: the latest page of orders;
 * - stock: GET /admin/stock-items.
 */

const FULFILLMENT: FulfillmentStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"];
const ACTIVE: FulfillmentStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"];
const RECENT_WINDOW = 50;
/** Page size the orders endpoint is known to accept, and a safety cap on paging through paid orders. */
const PAID_PAGE_SIZE = 50;
const MAX_PAID_PAGES = 40;
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

type Counts = {
  total: number;
  byFulfillment: Record<FulfillmentStatus, number>;
  unpaid: number;
  unpaidCancelled: number;
  paymentPending: number;
  paymentFailed: number;
};

type Section<T> = { data: T | null; error: string | null };
const loading = <T,>(): Section<T> => ({ data: null, error: null });

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Could not load this section.";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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

function collected(order: AdminOrder) {
  return order.total - (order.refunds ?? []).reduce((sum, r) => sum + r.amount, 0);
}

export default function AdminDashboardPage() {
  const { staff, accessToken, authorizedFetch } = useAdminAuth();
  const [counts, setCounts] = useState<Section<Counts>>(loading);
  const [recent, setRecent] = useState<Section<{ orders: AdminOrder[]; total: number }>>(loading);
  const [paid, setPaid] = useState<Section<{ orders: AdminOrder[]; complete: boolean }>>(loading);
  const [stock, setStock] = useState<Section<StockItem[]>>(loading);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<Range>(14);

  const list = useCallback(
    (params: Parameters<typeof adminClient.listOrders>[1]) =>
      authorizedFetch((token) => adminClient.listOrders(token, params)),
    [authorizedFetch],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const count = (params: { fulfillmentStatus?: FulfillmentStatus; paymentStatus?: PaymentStatus }) =>
      list({ ...params, page: 1, pageSize: 1 }).then((r) => r.meta.totalItems);

    // Counts (11 small requests).
    Promise.all([
      count({}),
      ...FULFILLMENT.map((status) => count({ fulfillmentStatus: status })),
      count({ paymentStatus: "UNPAID" }),
      count({ paymentStatus: "UNPAID", fulfillmentStatus: "CANCELLED" }),
      count({ paymentStatus: "PENDING" }),
      count({ paymentStatus: "FAILED" }),
    ])
      .then(([total, ...rest]) => {
        if (cancelled) return;
        const byFulfillment = Object.fromEntries(FULFILLMENT.map((s, i) => [s, rest[i]])) as Record<
          FulfillmentStatus,
          number
        >;
        const [unpaid, unpaidCancelled, paymentPending, paymentFailed] = rest.slice(FULFILLMENT.length);
        setCounts({ data: { total, byFulfillment, unpaid, unpaidCancelled, paymentPending, paymentFailed }, error: null });
      })
      .catch((err) => !cancelled && setCounts({ data: null, error: errorMessage(err) }));

    // Latest orders. Works whether the API pages newest- or oldest-first.
    (async () => {
      const first = await list({ page: 1, pageSize: RECENT_WINDOW });
      let orders = first.items;
      const oldestFirst =
        orders.length > 1 && new Date(orders[0].createdAt) < new Date(orders[orders.length - 1].createdAt);
      if (oldestFirst && first.meta.totalPages > 1) {
        const last: AdminOrdersResult = await list({ page: first.meta.totalPages, pageSize: RECENT_WINDOW });
        orders = [...last.items, ...orders].slice(-RECENT_WINDOW * 2);
      }
      orders = [...orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, RECENT_WINDOW);
      return { orders, total: first.meta.totalItems };
    })()
      .then((data) => !cancelled && setRecent({ data, error: null }))
      .catch((err) => !cancelled && setRecent({ data: null, error: errorMessage(err) }));

    // Every paid / partially refunded order, for revenue and best sellers.
    (async () => {
      const all: AdminOrder[] = [];
      let complete = true;
      for (const status of ["PAID", "PARTIALLY_REFUNDED"] as PaymentStatus[]) {
        const first = await list({ paymentStatus: status, page: 1, pageSize: PAID_PAGE_SIZE });
        all.push(...first.items);
        const pages = Math.min(first.meta.totalPages, MAX_PAID_PAGES);
        if (first.meta.totalPages > MAX_PAID_PAGES) complete = false;
        for (let page = 2; page <= pages; page++) {
          all.push(...(await list({ paymentStatus: status, page, pageSize: PAID_PAGE_SIZE })).items);
        }
      }
      return { orders: all, complete };
    })()
      .then((data) => !cancelled && setPaid({ data, error: null }))
      .catch((err) => !cancelled && setPaid({ data: null, error: errorMessage(err) }));

    authorizedFetch((token) => adminClient.listStockItems(token))
      .then((data) => !cancelled && setStock({ data, error: null }))
      .catch((err) => !cancelled && setStock({ data: null, error: errorMessage(err) }))
      .finally(() => !cancelled && setLoadedAt(new Date()));

    return () => {
      cancelled = true;
    };
  }, [accessToken, authorizedFetch, list, reloadKey]);

  function refresh() {
    setCounts(loading);
    setRecent(loading);
    setPaid(loading);
    setStock(loading);
    setReloadKey((k) => k + 1);
  }

  const c = counts.data;
  const isEmptyShop = c?.total === 0;
  const isLoadingAny = !loadedAt || (!counts.data && !counts.error);

  // --- derived values -----------------------------------------------------
  const today = startOfToday();
  const recentOrders = recent.data?.orders ?? [];
  const todaysRecent = recentOrders.filter((o) => new Date(o.createdAt).getTime() >= today);
  // The window covers all of today if it holds every order, or its oldest
  // order is from before today.
  const windowCoversToday =
    recent.data !== null &&
    (recentOrders.length >= recent.data.total ||
      (recentOrders.length > 0 && new Date(recentOrders[recentOrders.length - 1].createdAt).getTime() < today));

  const currency = paid.data?.orders[0]?.currency ?? recentOrders[0]?.currency ?? "EGP";
  const paidOrders = paid.data?.orders ?? [];
  const revenueAll = paidOrders.reduce((sum, o) => sum + collected(o), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const revenueMonth = paidOrders
    .filter((o) => new Date(o.createdAt).getTime() >= monthStart)
    .reduce((sum, o) => sum + collected(o), 0);

  const days = Array.from({ length: range }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (range - 1 - i));
    return d;
  });
  const byDay = new Map(days.map((d) => [dayKey(d), { value: 0, count: 0 }]));
  for (const o of paidOrders) {
    const bucket = byDay.get(dayKey(new Date(o.createdAt)));
    if (bucket) {
      bucket.value += collected(o);
      bucket.count += 1;
    }
  }
  const chart = days.map((d) => ({ date: d, ...(byDay.get(dayKey(d)) ?? { value: 0, count: 0 }) }));
  const rangeTotal = chart.reduce((sum, p) => sum + p.value, 0);
  const rangeOrders = chart.reduce((sum, p) => sum + p.count, 0);

  const sold = new Map<string, number>();
  for (const o of paidOrders) {
    for (const item of o.items ?? []) {
      const returned = (item.returns ?? []).reduce((sum, r) => sum + r.quantity, 0);
      sold.set(item.productNameEn, (sold.get(item.productNameEn) ?? 0) + item.quantity - returned);
    }
  }
  const bestSellers = [...sold.entries()].filter(([, qty]) => qty > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const personalized = recentOrders.filter(
    (o) =>
      (o.items ?? []).some((item) => item.customDesign) &&
      o.fulfillmentStatus !== "DELIVERED" &&
      o.fulfillmentStatus !== "CANCELLED",
  );
  const outOfStock = (stock.data ?? []).filter((s) => s.onHand - s.reserved <= 0);

  const active = c ? ACTIVE.reduce((sum, s) => sum + c.byFulfillment[s], 0) : null;
  const unpaidOpen = c ? c.unpaid - c.unpaidCancelled : null;

  const firstName = (staff?.fullName ?? "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const actions = c
    ? [
        { count: c.byFulfillment.PENDING, label: "Orders to confirm", href: "/admin/orders?fulfillment=PENDING", tone: "warn" as const },
        { count: unpaidOpen ?? 0, label: "Unpaid orders", href: "/admin/orders?payment=UNPAID", tone: "warn" as const },
        { count: c.paymentPending, label: "Payments to verify", href: "/admin/orders?payment=PENDING", tone: "warn" as const },
        { count: c.paymentFailed, label: "Failed payments", href: "/admin/orders?payment=FAILED", tone: "bad" as const },
        ...(stock.data
          ? [{ count: outOfStock.length, label: "Stock items out of stock", href: "/admin/stock", tone: "bad" as const }]
          : []),
        ...(recent.data
          ? [{ count: personalized.length, label: "Personalized orders in progress", href: "#personalized", tone: "warn" as const }]
          : []),
      ]
    : [];
  const openActions = actions.filter((a) => a.count > 0);

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink uppercase">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loadedAt && (
            <span className="me-1 text-xs text-muted-foreground">
              Updated {loadedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
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
              className={`size-4 ${isLoadingAny ? "animate-spin" : ""}`}
            >
              <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5" />
            </svg>
          </button>
          <QuickLink href="/admin/orders">Orders</QuickLink>
          <Link
            href="/admin/products/new"
            className={`rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent ${focusRing}`}
          >
            + Add product
          </Link>
        </div>
      </header>

      {isEmptyShop ? (
        <div className="mt-8 rounded-card bg-surface p-10 text-center">
          <h2 className="font-display text-2xl text-ink uppercase">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Once customers start ordering, sales and order activity will appear here.
          </p>
          <Link
            href="/admin/products"
            className="mt-5 inline-block rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
          >
            View products
          </Link>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              label="Revenue this month"
              error={paid.error}
              value={paid.data ? formatPrice(revenueMonth, currency) : null}
              note={paid.data ? `${formatPrice(revenueAll, currency)} all time` : undefined}
              hint="Orders marked paid, minus refunds"
            />
            <Kpi
              label="Orders"
              error={counts.error}
              value={c ? c.total.toLocaleString("en-US") : null}
              note={
                recent.data ? `${todaysRecent.length}${windowCoversToday ? "" : "+"} placed today` : undefined
              }
            />
            <Kpi
              label="In progress"
              error={counts.error}
              value={active !== null ? active.toLocaleString("en-US") : null}
              note={c ? `${c.byFulfillment.PENDING} waiting to be confirmed` : undefined}
              href="/admin/orders?fulfillment=PENDING"
            />
            <Kpi
              label="Unpaid"
              error={counts.error}
              value={unpaidOpen !== null ? unpaidOpen.toLocaleString("en-US") : null}
              note="Open orders not paid yet"
              tone={unpaidOpen ? "warn" : undefined}
              href="/admin/orders?payment=UNPAID"
            />
          </div>

          {/* Revenue + attention */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <Card
              title="Collected revenue"
              action={
                <Segmented
                  label="Chart range"
                  value={range}
                  options={RANGES.map((r) => ({ value: r, label: `${r}d` }))}
                  onChange={setRange}
                />
              }
            >
              {paid.error ? (
                <ErrorText>{paid.error}</ErrorText>
              ) : !paid.data ? (
                <Skeleton className="h-60" />
              ) : (
                <>
                  <p className="font-display text-3xl text-ink">{formatPrice(rangeTotal, currency)}</p>
                  <p className="text-sm text-muted-foreground">
                    {rangeOrders} paid {rangeOrders === 1 ? "order" : "orders"} in the last {range} days
                  </p>
                  <RevenueChart points={chart} currency={currency} />
                  {!paid.data.complete && (
                    <p className="mt-2 text-xs text-amber-700">
                      Only the first {MAX_PAID_PAGES * PAID_PAGE_SIZE} paid orders per status were included.
                    </p>
                  )}
                </>
              )}
            </Card>

            <Card title="Needs attention">
              {counts.error && !c ? (
                <ErrorText>{counts.error}</ErrorText>
              ) : !c ? (
                <Skeleton className="h-48" />
              ) : openActions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-800">
                    ✓
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink">All clear</p>
                  <p className="text-xs text-muted-foreground">Nothing is waiting on you.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {openActions.map((a) => (
                    <li key={a.label}>
                      <Link
                        href={a.href}
                        className={`group flex items-center gap-3 rounded-xl bg-background px-3 py-2.5 text-sm transition-colors hover:bg-border/50 ${focusRing}`}
                      >
                        <span
                          className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold ${
                            a.tone === "bad" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {a.count}
                        </span>
                        <span className="min-w-0 flex-1 text-ink">{a.label}</span>
                        <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Pipeline */}
          <div className="mt-3">
            <Card title="Order pipeline" action={<CardLink href="/admin/orders">All orders</CardLink>}>
              {counts.error ? (
                <ErrorText>{counts.error}</ErrorText>
              ) : !c ? (
                <Skeleton className="h-28" />
              ) : (
                <>
                  {c.total > 0 && (
                    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                      {FULFILLMENT.filter((s) => c.byFulfillment[s] > 0).map((status) => (
                        <span
                          key={status}
                          className={`${PIPELINE_COLOR[status]} first:rounded-s-full last:rounded-e-full`}
                          style={{ width: `${(c.byFulfillment[status] / c.total) * 100}%` }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {FULFILLMENT.map((status) => (
                      <Link
                        key={status}
                        href={`/admin/orders?fulfillment=${status}`}
                        className={`rounded-xl bg-background p-3 transition-colors hover:bg-border/50 ${focusRing}`}
                      >
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <span aria-hidden className={`size-2 rounded-full ${PIPELINE_COLOR[status]}`} />
                          {STATUS_LABEL[status]}
                        </p>
                        <p className="mt-1 flex items-baseline gap-1.5">
                          <span className="font-display text-3xl text-ink">{c.byFulfillment[status]}</span>
                          {c.total > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {Math.round((c.byFulfillment[status] / c.total) * 100)}%
                            </span>
                          )}
                        </p>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Recent orders + best sellers */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <Card title="Recent orders" action={<CardLink href="/admin/orders">View all</CardLink>}>
              {recent.error ? (
                <ErrorText>{recent.error}</ErrorText>
              ) : !recent.data ? (
                <Skeleton className="h-64" />
              ) : (
                <RecentOrders orders={recentOrders.slice(0, 8)} />
              )}
            </Card>

            <Card title="Best sellers" action={<span className="text-xs text-muted-foreground">Units sold</span>}>
              {paid.error ? (
                <ErrorText>{paid.error}</ErrorText>
              ) : !paid.data ? (
                <Skeleton className="h-48" />
              ) : bestSellers.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No paid orders yet.</p>
              ) : (
                <ol className="flex flex-col gap-3.5 text-sm">
                  {bestSellers.map(([name, qty], index) => (
                    <li key={name}>
                      <div className="flex items-baseline gap-2">
                        <span className="w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-ink" title={name}>
                          {name}
                        </span>
                        <span className="shrink-0 font-semibold text-ink tabular-nums">{qty}</span>
                      </div>
                      <div className="ms-6 mt-1.5 h-1.5 rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-ink"
                          style={{ width: `${(qty / bestSellers[0][1]) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          {/* Personalized + stock */}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div id="personalized" className="scroll-mt-6">
              <Card
                title="Personalized orders in progress"
                action={<span className="text-xs text-muted-foreground">Latest {RECENT_WINDOW} orders</span>}
              >
                {recent.error ? (
                  <ErrorText>{recent.error}</ErrorText>
                ) : !recent.data ? (
                  <Skeleton className="h-24" />
                ) : personalized.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None right now.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border text-sm">
                    {personalized.slice(0, 6).map((o) => (
                      <li key={o.id}>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="flex items-center justify-between gap-3 py-2.5 hover:text-accent"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-semibold text-ink">#{o.sequenceNumber}</span>{" "}
                            <span className="text-muted-foreground">{o.customerFullName}</span>
                          </span>
                          <StatusBadge status={o.fulfillmentStatus} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Out of stock" action={<CardLink href="/admin/stock">Manage stock</CardLink>}>
              {stock.error ? (
                <ErrorText>{stock.error}</ErrorText>
              ) : !stock.data ? (
                <Skeleton className="h-24" />
              ) : outOfStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every tracked stock item has units available.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border text-sm">
                  {outOfStock.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-ink">{s.nameEn}</span>
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                        {s.onHand} on hand · {s.reserved} reserved
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STATUS_LABEL: Record<FulfillmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PIPELINE_COLOR: Record<FulfillmentStatus, string> = {
  PENDING: "bg-amber-400",
  CONFIRMED: "bg-blue-400",
  PREPARING: "bg-amber-600",
  SHIPPED: "bg-blue-700",
  DELIVERED: "bg-green-600",
  CANCELLED: "bg-red-300",
};

/** Whole-pound amount, shortened for axis labels: 1250 -> "1.3k". */
function compactMoney(minor: number) {
  const units = minor / 100;
  if (units >= 1000) return `${(units / 1000).toFixed(units >= 10000 ? 0 : 1)}k`;
  return Math.round(units).toLocaleString("en-US");
}

/** Rounds a max up to 1 / 2 / 2.5 / 5 × 10^n so gridlines land on clean values. */
function niceCeil(value: number) {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * exp >= value) ?? 10;
  return step * exp;
}

function RevenueChart({
  points,
  currency,
}: {
  points: { date: Date; value: number; count: number }[];
  currency: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceCeil(Math.max(0, ...points.map((p) => p.value)));
  const ticks = [max, max / 2, 0];
  const labelEvery = points.length > 14 ? 5 : points.length > 7 ? 2 : 1;
  const active = hovered !== null ? points[hovered] : null;

  return (
    <div className="mt-5">
      <div className="relative flex h-52 gap-2">
        {/* y axis */}
        <div className="flex w-10 shrink-0 flex-col justify-between pb-5 text-end text-[10px] text-muted-foreground tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {compactMoney(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* gridlines */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
            {ticks.map((t) => (
              <span key={t} className={`border-t ${t === 0 ? "border-border" : "border-dashed border-border/70"}`} />
            ))}
          </div>
          {/* bars */}
          <div
            className="absolute inset-0 flex"
            role="img"
            aria-label={`Collected revenue per day for the last ${points.length} days`}
            onMouseLeave={() => setHovered(null)}
          >
            {points.map((p, i) => (
              <div
                key={dayKey(p.date)}
                className="flex h-full min-w-0 flex-1 cursor-default flex-col items-center"
                onMouseEnter={() => setHovered(i)}
              >
                <div className="flex w-full flex-1 items-end justify-center px-[1px]">
                  <div
                    className={`w-full max-w-7 rounded-t-[4px] transition-colors ${
                      hovered === i ? "bg-accent" : hovered !== null ? "bg-ink/35" : "bg-ink"
                    }`}
                    style={{ height: `${p.value > 0 ? Math.max(2, (p.value / max) * 100) : 0}%` }}
                  />
                </div>
                <span className="h-5 pt-1.5 text-[10px] leading-none text-muted-foreground tabular-nums">
                  {(points.length - 1 - i) % labelEvery === 0 ? p.date.getDate() : ""}
                </span>
              </div>
            ))}
          </div>
          {/* tooltip */}
          {active && hovered !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
              style={{
                left: `clamp(4.5rem, ${((hovered + 0.5) / points.length) * 100}%, calc(100% - 4.5rem))`,
              }}
            >
              <p className="text-white/70">
                {active.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <p className="mt-0.5 font-semibold">{formatPrice(active.value, currency)}</p>
              <p className="text-white/70">
                {active.count} {active.count === 1 ? "order" : "orders"}
              </p>
            </div>
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>Collected revenue per day</caption>
        <tbody>
          {points.map((p) => (
            <tr key={dayKey(p.date)}>
              <th scope="row">{p.date.toLocaleDateString("en-GB")}</th>
              <td>{formatPrice(p.value, currency)}</td>
              <td>{p.count} orders</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Segmented<T extends number | string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-pill bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${focusRing} ${
            o.value === value ? "bg-ink text-white" : "text-muted-foreground hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="h-full rounded-card bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  note,
  hint,
  error,
  tone,
  href,
}: {
  label: string;
  value: string | null;
  note?: string;
  hint?: string;
  error: string | null;
  tone?: "warn";
  href?: string;
}) {
  const content = (
    <>
      <p className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
        {label}
        {href && (
          <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100">
            →
          </span>
        )}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-accent">{error}</p>
      ) : value === null ? (
        <Skeleton className="mt-3 h-9 w-28" />
      ) : (
        <p
          className={`mt-2 truncate font-display text-3xl sm:text-4xl ${tone === "warn" ? "text-amber-700" : "text-ink"}`}
          title={value}
        >
          {value}
        </p>
      )}
      {note && !error && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{note}</p>}
    </>
  );
  const className = `group block h-full rounded-card bg-surface p-4 shadow-card sm:p-5 ${focusRing}`;
  return href ? (
    <Link href={href} className={`${className} transition-transform hover:-translate-y-0.5`} title={hint}>
      {content}
    </Link>
  ) : (
    <div className={className} title={hint}>
      {content}
    </div>
  );
}

function RecentOrders({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">No orders yet.</p>;
  return (
    <>
      {/* Table on md+ */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-b border-border text-start text-xs text-muted-foreground">
            <th className="py-2 pe-3 text-start font-semibold">Order</th>
            <th className="py-2 pe-3 text-start font-semibold">Items</th>
            <th className="py-2 pe-3 text-start font-semibold">Status</th>
            <th className="py-2 pe-3 text-end font-semibold">Total</th>
            <th className="py-2 text-end font-semibold">Placed</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="group border-b border-border last:border-0">
              <td className="py-3 pe-3">
                <Link href={`/admin/orders/${o.id}`} className="block group-hover:text-accent">
                  <span className="font-semibold text-ink group-hover:text-accent">#{o.sequenceNumber}</span>
                  <span className="block max-w-40 truncate text-xs text-muted-foreground">{o.customerFullName}</span>
                </Link>
              </td>
              <td className="max-w-56 truncate py-3 pe-3 text-muted-foreground">{itemSummary(o)}</td>
              <td className="py-3 pe-3">
                <span className="flex flex-wrap gap-1">
                  <StatusBadge status={o.fulfillmentStatus} />
                  <StatusBadge status={o.paymentStatus} />
                </span>
              </td>
              <td className="py-3 pe-3 text-end font-semibold whitespace-nowrap text-ink tabular-nums">
                {formatPrice(o.total, o.currency)}
              </td>
              <td className="py-3 text-end whitespace-nowrap text-muted-foreground" title={exactTime(o.createdAt)}>
                {relativeTime(o.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cards below md */}
      <ul className="flex flex-col divide-y divide-border md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`} className="block py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-ink">
                  #{o.sequenceNumber} <span className="font-normal text-muted-foreground">{o.customerFullName}</span>
                </span>
                <span className="shrink-0 font-semibold text-ink">{formatPrice(o.total, o.currency)}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{itemSummary(o)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={o.fulfillmentStatus} />
                <StatusBadge status={o.paymentStatus} />
                <span className="text-xs text-muted-foreground" title={exactTime(o.createdAt)}>
                  {relativeTime(o.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function itemSummary(order: AdminOrder) {
  const items = order.items ?? [];
  if (items.length === 0) return "—";
  return `${items[0].productNameEn}${items.length > 1 ? ` +${items.length - 1}` : ""}`;
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink ${focusRing}`}
    >
      {children}
    </Link>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold text-accent hover:underline">
      {children} →
    </Link>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-accent">
      {children}
    </p>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-background ${className}`} />;
}
