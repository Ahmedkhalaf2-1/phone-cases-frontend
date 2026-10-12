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
const CHART_DAYS = 14;

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

  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (CHART_DAYS - 1 - i));
    return d;
  });
  const byDay = new Map(days.map((d) => [dayKey(d), 0]));
  for (const o of paidOrders) {
    const key = dayKey(new Date(o.createdAt));
    if (byDay.has(key)) byDay.set(key, byDay.get(key)! + collected(o));
  }
  const chart = days.map((d) => ({ date: d, value: byDay.get(dayKey(d)) ?? 0 }));
  const chartMax = Math.max(0, ...chart.map((p) => p.value));

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

  return (
    <div className="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back{staff?.fullName ? `, ${staff.fullName}` : ""}.
            {loadedAt && ` Updated ${loadedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/admin/orders">Orders</QuickLink>
          <QuickLink href="/admin/products/new">Add product</QuickLink>
          <QuickLink href="/admin/stock">Stock</QuickLink>
          <button
            type="button"
            onClick={refresh}
            className="rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Refresh
          </button>
        </div>
      </header>

      {isEmptyShop ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-10 text-center">
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
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Total orders"
              error={counts.error}
              value={c ? c.total.toLocaleString("en-US") : null}
              note={
                recent.data
                  ? windowCoversToday
                    ? `${todaysRecent.length} today`
                    : `${todaysRecent.length}+ today`
                  : undefined
              }
            />
            <Kpi
              label="Collected revenue"
              error={paid.error}
              value={paid.data ? formatPrice(revenueAll, currency) : null}
              note={paid.data ? `${formatPrice(revenueMonth, currency)} this month` : undefined}
              hint="Orders marked paid, minus refunds"
            />
            <Kpi
              label="Active orders"
              error={counts.error}
              value={active !== null ? active.toLocaleString("en-US") : null}
              note={c ? `${c.byFulfillment.PENDING} waiting to be confirmed` : undefined}
            />
            <Kpi
              label="Unpaid"
              error={counts.error}
              value={unpaidOpen !== null ? unpaidOpen.toLocaleString("en-US") : null}
              note="Excluding cancelled orders"
              tone={unpaidOpen ? "warn" : undefined}
            />
          </div>

          {/* Pipeline + actions */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Card title="Fulfillment pipeline" action={<CardLink href="/admin/orders">All orders</CardLink>}>
              {counts.error ? (
                <ErrorText>{counts.error}</ErrorText>
              ) : !c ? (
                <Skeleton className="h-24" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                    {FULFILLMENT.map((status) => (
                      <div
                        key={status}
                        className={`rounded-xl border p-3 ${
                          status === "CANCELLED" ? "border-border bg-background" : "border-border bg-surface"
                        }`}
                      >
                        <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                          {status}
                        </p>
                        <p className="mt-1 font-display text-3xl text-ink">{c.byFulfillment[status]}</p>
                      </div>
                    ))}
                  </div>
                  {c.total > 0 && (
                    <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-background" aria-hidden>
                      {FULFILLMENT.map((status) => (
                        <span
                          key={status}
                          className={PIPELINE_COLOR[status]}
                          style={{ width: `${(c.byFulfillment[status] / c.total) * 100}%` }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card title="Action required">
              {counts.error && !c ? (
                <ErrorText>{counts.error}</ErrorText>
              ) : !c ? (
                <Skeleton className="h-32" />
              ) : (
                <ul className="flex flex-col divide-y divide-border text-sm">
                  <ActionRow count={c.byFulfillment.PENDING} label="orders waiting to be confirmed" href="/admin/orders" />
                  <ActionRow count={unpaidOpen ?? 0} label="unpaid orders (not cancelled)" href="/admin/orders" />
                  <ActionRow count={c.paymentPending} label="payments pending verification" href="/admin/orders" />
                  <ActionRow count={c.paymentFailed} label="failed payments" href="/admin/orders" tone="bad" />
                  {stock.data && (
                    <ActionRow count={outOfStock.length} label="stock items out of stock" href="/admin/stock" tone="bad" />
                  )}
                  {recent.data && (
                    <ActionRow
                      count={personalized.length}
                      label={`personalized orders in progress (latest ${RECENT_WINDOW})`}
                      href="#personalized"
                    />
                  )}
                </ul>
              )}
            </Card>
          </div>

          {/* Sales */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Card
              title={`Collected revenue · last ${CHART_DAYS} days`}
              action={<span className="text-xs text-muted-foreground">Paid orders, by order date</span>}
            >
              {paid.error ? (
                <ErrorText>{paid.error}</ErrorText>
              ) : !paid.data ? (
                <Skeleton className="h-40" />
              ) : chartMax === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No paid orders in the last {CHART_DAYS} days.
                </p>
              ) : (
                <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Collected revenue per day">
                  {chart.map(({ date, value }) => (
                    <div key={dayKey(date)} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
                      <div
                        className="w-full rounded-t-md bg-ink transition-[height]"
                        style={{ height: `${Math.max(value > 0 ? 3 : 0, (value / chartMax) * 85)}%` }}
                        title={`${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${formatPrice(value, currency)}`}
                      />
                      <span className="truncate text-center text-[10px] text-muted-foreground">{date.getDate()}</span>
                    </div>
                  ))}
                </div>
              )}
              {paid.data && !paid.data.complete && (
                <p className="mt-2 text-xs text-amber-700">
                  Only the first {MAX_PAID_PAGES * PAID_PAGE_SIZE} paid orders per status were included.
                </p>
              )}
            </Card>

            <Card title="Best sellers" action={<span className="text-xs text-muted-foreground">Paid orders, net of returns</span>}>
              {paid.error ? (
                <ErrorText>{paid.error}</ErrorText>
              ) : !paid.data ? (
                <Skeleton className="h-40" />
              ) : bestSellers.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No paid orders yet.</p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {bestSellers.map(([name, qty], index) => (
                    <li key={name} className="flex items-baseline gap-3">
                      <span className="w-4 shrink-0 text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{name}</span>
                      <span className="shrink-0 font-semibold text-ink">{qty} sold</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          {/* Recent orders */}
          <div className="mt-6">
            <Card title="Recent orders" action={<CardLink href="/admin/orders">View all</CardLink>}>
              {recent.error ? (
                <ErrorText>{recent.error}</ErrorText>
              ) : !recent.data ? (
                <Skeleton className="h-64" />
              ) : (
                <RecentOrders orders={recentOrders.slice(0, 8)} />
              )}
            </Card>
          </div>

          {/* Personalized + stock */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div id="personalized" className="scroll-mt-6">
              <Card
                title="Personalized orders in progress"
                action={<span className="text-xs text-muted-foreground">From the latest {RECENT_WINDOW} orders</span>}
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
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/admin/orders/${o.id}`} className="min-w-0 hover:text-accent">
                          <span className="font-semibold text-ink">#{o.sequenceNumber}</span>{" "}
                          <span className="text-muted-foreground">{o.customerFullName}</span>
                        </Link>
                        <StatusBadge status={o.fulfillmentStatus} />
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
                <p className="text-sm text-muted-foreground">
                  Every tracked stock item has units available.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border text-sm">
                  {outOfStock.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-ink">{s.nameEn}</span>
                      <span className="shrink-0 text-xs font-semibold text-red-700">
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

const PIPELINE_COLOR: Record<FulfillmentStatus, string> = {
  PENDING: "bg-amber-400",
  CONFIRMED: "bg-blue-400",
  PREPARING: "bg-amber-600",
  SHIPPED: "bg-blue-700",
  DELIVERED: "bg-green-600",
  CANCELLED: "bg-red-300",
};

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="h-full rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{title}</h2>
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
}: {
  label: string;
  value: string | null;
  note?: string;
  hint?: string;
  error: string | null;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5" title={hint}>
      <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</p>
      {error ? (
        <p className="mt-3 text-sm text-accent">{error}</p>
      ) : value === null ? (
        <Skeleton className="mt-3 h-9 w-28" />
      ) : (
        <p className={`mt-2 font-display text-4xl ${tone === "warn" ? "text-amber-700" : "text-ink"}`}>{value}</p>
      )}
      {note && !error && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      {hint && !error && <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function ActionRow({
  count,
  label,
  href,
  tone,
}: {
  count: number;
  label: string;
  href: string;
  tone?: "bad";
}) {
  const attention = count > 0;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className={attention ? "text-ink" : "text-muted-foreground"}>
        <span
          className={`me-2 font-semibold ${attention ? (tone === "bad" ? "text-red-700" : "text-amber-700") : ""}`}
        >
          {count}
        </span>
        {label}
      </span>
      {attention && (
        <Link href={href} className="shrink-0 text-xs font-semibold text-accent hover:underline">
          View
        </Link>
      )}
    </li>
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
            <th className="py-2 pe-3 text-start font-semibold">Customer</th>
            <th className="py-2 pe-3 text-start font-semibold">Items</th>
            <th className="py-2 pe-3 text-start font-semibold">Status</th>
            <th className="py-2 pe-3 text-start font-semibold">Payment</th>
            <th className="py-2 pe-3 text-end font-semibold">Total</th>
            <th className="py-2 pe-3 text-start font-semibold">Placed</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border last:border-0 hover:bg-background">
              <td className="py-3 pe-3 font-semibold text-ink">#{o.sequenceNumber}</td>
              <td className="max-w-40 truncate py-3 pe-3 text-ink">{o.customerFullName}</td>
              <td className="max-w-56 truncate py-3 pe-3 text-muted-foreground">{itemSummary(o)}</td>
              <td className="py-3 pe-3">
                <StatusBadge status={o.fulfillmentStatus} />
              </td>
              <td className="py-3 pe-3">
                <StatusBadge status={o.paymentStatus} />
              </td>
              <td className="py-3 pe-3 text-end font-semibold text-ink">{formatPrice(o.total, o.currency)}</td>
              <td className="py-3 pe-3 whitespace-nowrap text-muted-foreground" title={exactTime(o.createdAt)}>
                {relativeTime(o.createdAt)}
              </td>
              <td className="py-3 text-end">
                <Link href={`/admin/orders/${o.id}`} className="text-xs font-semibold text-accent hover:underline">
                  View
                </Link>
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
                <span className="font-semibold text-ink">
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
      className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
