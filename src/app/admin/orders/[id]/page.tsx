"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { useAdminCatalog } from "@/lib/admin/catalog-store";
import { primaryImageUrl } from "@/lib/admin/product-display";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReceiptViewer } from "@/components/admin/ReceiptViewer";
import { CustomDesignViewer } from "@/components/admin/CustomDesignViewer";
import type { AdminOrder, AdminOrderItem, FulfillmentStatus, PaymentStatus } from "@/lib/admin/types";

const FULFILLMENT_VALUES: FulfillmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];
/** The normal forward path, for the progress tracker. CANCELLED sits outside it. */
const FULFILLMENT_STEPS: FulfillmentStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"];
const PAYMENT_VALUES: PaymentStatus[] = ["UNPAID", "PENDING", "PAID", "FAILED"];

const PAYMENT_METHOD_LABEL: Record<AdminOrder["paymentMethod"], string> = {
  CASH_ON_DELIVERY: "Cash on delivery",
  INSTAPAY_MANUAL: "InstaPay (manual transfer)",
};

const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";
const secondaryButtonClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors enabled:hover:border-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primaryButtonClass =
  "rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { accessToken, authorizedFetch, staff } = useAdminAuth();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lateNote, setLateNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [returnState, setReturnState] = useState<
    Record<string, { quantity: string; reason: string }>
  >({});
  const [openReturnFor, setOpenReturnFor] = useState<string | null>(null);

  // Order items carry no image; look the product's current main image up
  // by variant id in the shared admin catalog (loaded once per session).
  const catalog = useAdminCatalog();
  const imageByVariant = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of catalog.products ?? []) {
      const image = primaryImageUrl(product);
      if (!image) continue;
      for (const variant of product.variants ?? []) map.set(variant.id, image);
    }
    return map;
  }, [catalog.products]);

  const isOwner = staff?.role === "OWNER_ADMIN";

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.getOrder(token, id))
      .then(setOrder)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load order."),
      );
  }

  useEffect(load, [accessToken, authorizedFetch, id]);

  async function withBusy(action: () => Promise<void>) {
    setIsBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!order) return <LoadingRow label="Loading order…" />;

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const hasCustomDesign = order.items.some((item) => item.customDesign);
  const canRefund =
    isOwner && (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED");

  function recordReturn(item: AdminOrderItem, quantity: string, reason: string) {
    return withBusy(async () => {
      await authorizedFetch((token) =>
        adminClient.createItemReturn(token, order!.id, item.id, {
          quantity: Number(quantity),
          reason,
        }),
      );
      setReturnState((s) => ({ ...s, [item.id]: { quantity: "", reason: "" } }));
      setOpenReturnFor(null);
      load();
    });
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <Link
        href="/admin/orders"
        className="text-sm text-muted-foreground transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ← Orders
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">
            Order #{order.sequenceNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDateTime(order.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.fulfillmentStatus} />
          <StatusBadge status={order.paymentStatus} />
          {hasCustomDesign && (
            <span className="inline-flex items-center rounded-full bg-accent-wash px-2 py-0.5 text-xs font-semibold text-ink uppercase">
              Personalized
            </span>
          )}
        </div>
      </header>

      {order.customerNote && (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
          <p className="text-xs font-bold tracking-wider text-amber-900 uppercase">Customer note</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-amber-950" dir="auto">
            {order.customerNote}
          </p>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card title="Customer">
              <p className="font-semibold text-ink">{order.customerFullName}</p>
              <a
                href={`tel:${order.customerPhone}`}
                className="mt-1 block text-sm text-ink underline-offset-4 hover:text-accent hover:underline"
              >
                {order.customerPhone}
              </a>
              {order.customerEmail && (
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="mt-0.5 block text-sm break-all text-ink underline-offset-4 hover:text-accent hover:underline"
                >
                  {order.customerEmail}
                </a>
              )}
            </Card>

            <Card title="Delivery address">
              <dl className="flex flex-col gap-2 text-sm">
                <InfoRow label="Address" value={order.shippingAddressLine1} />
                {order.shippingAddressLine2 && (
                  <InfoRow label="Address line 2" value={order.shippingAddressLine2} />
                )}
                <InfoRow label="City" value={order.shippingCity} />
                {order.shippingPostalCode && <InfoRow label="Postal code" value={order.shippingPostalCode} />}
                <InfoRow label="Country" value={countryName(order.shippingCountry)} />
              </dl>
            </Card>
          </div>

          <Card title={`Items · ${itemCount}`}>
            <ul className="flex flex-col divide-y divide-border">
              {order.items.map((item) => {
                const returnedQty = item.returns?.reduce((sum, r) => sum + r.quantity, 0) ?? 0;
                const rowState = returnState[item.id] ?? { quantity: "", reason: "" };
                const image = imageByVariant.get(item.variantId) ?? null;
                const canReturn = isOwner && returnedQty < item.quantity;
                const isReturnOpen = openReturnFor === item.id;
                return (
                  <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex gap-4">
                      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-background sm:size-24">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={item.productNameEn}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No image
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {item.productNameEn}
                            {item.customDesign && (
                              <span className="ms-2 inline-flex rounded-full bg-accent-wash px-2 py-0.5 align-middle text-[11px] font-semibold uppercase">
                                Personalized
                              </span>
                            )}
                          </p>
                          <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-sm text-muted-foreground sm:grid-cols-[auto_1fr]">
                            {item.phoneModelNameEn && <ItemMeta label="Phone" value={item.phoneModelNameEn} />}
                            {item.caseTypeNameEn && <ItemMeta label="Case" value={item.caseTypeNameEn} />}
                            <ItemMeta label="SKU" value={item.variantSku} mono />
                          </dl>
                        </div>
                        <div className="shrink-0 text-sm sm:text-end">
                          <p className="font-semibold text-ink">{formatPrice(item.lineTotal, order.currency)}</p>
                          <p className="text-muted-foreground">
                            {item.quantity} × {formatPrice(item.unitPrice, order.currency)}
                          </p>
                          {item.customizationPrice ? (
                            <p className="text-xs text-muted-foreground">
                              incl. {formatPrice(item.customizationPrice, order.currency)} design
                            </p>
                          ) : null}
                          {item.lineDiscount > 0 && (
                            <p className="text-xs text-green-700">
                              −{formatPrice(item.lineDiscount, order.currency)} discount
                            </p>
                          )}
                          {item.bundleDiscount > 0 && (
                            <p className="text-xs text-green-700">
                              −{formatPrice(item.bundleDiscount, order.currency)} bundle
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {item.note && (
                      <p
                        className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm whitespace-pre-wrap text-amber-900"
                        dir="auto"
                      >
                        <span className="font-semibold">Item note:</span> {item.note}
                      </p>
                    )}

                    {item.customDesign && (
                      <CustomDesignViewer
                        design={item.customDesign}
                        fileBaseName={`order-${order.sequenceNumber}-${item.variantSku}`}
                      />
                    )}

                    {(returnedQty > 0 || canReturn) && (
                      <div className="mt-3">
                        {returnedQty > 0 && (
                          <ul className="mb-2 flex flex-col gap-1 text-xs text-muted-foreground">
                            {item.returns.map((r) => (
                              <li key={r.id}>
                                Returned {r.quantity} — {r.reason}
                              </li>
                            ))}
                          </ul>
                        )}
                        {canReturn && !isReturnOpen && (
                          <button
                            type="button"
                            onClick={() => setOpenReturnFor(item.id)}
                            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
                          >
                            Record return
                          </button>
                        )}
                        {canReturn && isReturnOpen && (
                          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-3">
                            <input
                              type="number"
                              min={1}
                              max={item.quantity - returnedQty}
                              placeholder="Qty"
                              aria-label="Quantity to return"
                              value={rowState.quantity}
                              onChange={(e) =>
                                setReturnState((s) => ({
                                  ...s,
                                  [item.id]: { ...rowState, quantity: e.target.value },
                                }))
                              }
                              className={`w-20 ${inputClass}`}
                            />
                            <input
                              placeholder="Return reason"
                              aria-label="Return reason"
                              value={rowState.reason}
                              onChange={(e) =>
                                setReturnState((s) => ({
                                  ...s,
                                  [item.id]: { ...rowState, reason: e.target.value },
                                }))
                              }
                              className={`min-w-0 flex-1 ${inputClass}`}
                            />
                            <button
                              type="button"
                              disabled={isBusy || !rowState.quantity || !rowState.reason}
                              onClick={() => recordReturn(item, rowState.quantity, rowState.reason)}
                              className={primaryButtonClass}
                            >
                              Record return
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenReturnFor(null)}
                              className={secondaryButtonClass}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Fulfillment">
            <FulfillmentTracker status={order.fulfillmentStatus} />
            <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="fulfillment-status">
              Update fulfillment status
            </label>
            <select
              id="fulfillment-status"
              disabled={isBusy}
              value={order.fulfillmentStatus}
              onChange={(e) =>
                withBusy(async () => {
                  const updated = await authorizedFetch((token) =>
                    adminClient.updateFulfillmentStatus(
                      token,
                      order.id,
                      e.target.value as FulfillmentStatus,
                    ),
                  );
                  setOrder(updated);
                })
              }
              className={`mt-1.5 block w-full max-w-xs ${inputClass}`}
            >
              {FULFILLMENT_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Order summary">
            <dl className="flex flex-col gap-2 text-sm">
              <SummaryRow label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
              {order.discountTotal > 0 && (
                <SummaryRow
                  label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                  value={`−${formatPrice(order.discountTotal, order.currency)}`}
                />
              )}
              {order.bundleDiscountTotal > 0 && (
                <SummaryRow
                  label="Bundle discount"
                  value={`−${formatPrice(order.bundleDiscountTotal, order.currency)}`}
                />
              )}
              <SummaryRow
                label={`Shipping · ${order.shippingRateNameEn}`}
                value={order.shippingTotal === 0 ? "Free" : formatPrice(order.shippingTotal, order.currency)}
              />
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-3xl text-ink">{formatPrice(order.total, order.currency)}</span>
            </div>
            {order.refunds.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Refunded{" "}
                {formatPrice(
                  order.refunds.reduce((sum, r) => sum + r.amount, 0),
                  order.currency,
                )}
              </p>
            )}
          </Card>

          <Card title="Payment">
            <dl className="flex flex-col gap-2 text-sm">
              <InfoRow label="Method" value={PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod} />
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-0.5">
                  <StatusBadge status={order.paymentStatus} />
                </dd>
              </div>
            </dl>

            <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="payment-status">
              Update payment status {!isOwner && <span className="font-normal text-muted-foreground">(owner only)</span>}
            </label>
            <select
              id="payment-status"
              disabled={isBusy || !isOwner}
              value={order.paymentStatus}
              onChange={(e) =>
                withBusy(async () => {
                  const updated = await authorizedFetch((token) =>
                    adminClient.updatePaymentStatus(
                      token,
                      order.id,
                      e.target.value as PaymentStatus,
                    ),
                  );
                  setOrder(updated);
                })
              }
              className={`mt-1.5 block w-full ${inputClass}`}
            >
              {PAYMENT_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            {isOwner && order.receipts.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-ink">Payment receipts</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {order.receipts.map((receipt) => (
                    <li key={receipt.id} className="flex items-start gap-3 text-sm">
                      <ReceiptViewer receiptId={receipt.id} />
                      <div className="flex min-w-0 flex-col gap-1">
                        <StatusBadge status={receipt.status} />
                        <p className="text-xs text-muted-foreground">Uploaded {formatDateTime(receipt.createdAt)}</p>
                        {receipt.rejectionReason && (
                          <p className="text-xs text-muted-foreground">Reason: {receipt.rejectionReason}</p>
                        )}
                        {receipt.status === "PENDING_REVIEW" && (
                          <div className="mt-1 flex flex-col gap-2">
                            <input
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Rejection reason"
                              aria-label="Rejection reason"
                              className={inputClass}
                            />
                            <button
                              type="button"
                              disabled={isBusy || !rejectReason}
                              onClick={() =>
                                withBusy(async () => {
                                  await authorizedFetch((token) =>
                                    adminClient.rejectReceipt(token, order.id, receipt.id, rejectReason),
                                  );
                                  setRejectReason("");
                                  load();
                                })
                              }
                              className={`${secondaryButtonClass} self-start text-accent`}
                            >
                              Reject receipt
                            </button>
                            <p className="text-xs text-muted-foreground">
                              Or set the payment status to PAID once verified.
                            </p>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canRefund && (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-ink">Refunds</h3>
                {order.refunds.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {order.refunds.map((refund) => (
                      <li key={refund.id} className="flex justify-between gap-3">
                        <span className="min-w-0 text-muted-foreground">
                          {refund.reason}
                          <span className="block text-xs">{formatDateTime(refund.createdAt)}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-ink">
                          −{formatPrice(refund.amount, refund.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount (minor units)"
                    aria-label="Refund amount in minor units"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Reason"
                    aria-label="Refund reason"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={isBusy || !refundAmount || !refundReason}
                    onClick={() =>
                      withBusy(async () => {
                        await authorizedFetch((token) =>
                          adminClient.createRefund(token, order.id, {
                            amount: Number(refundAmount),
                            currency: order.currency,
                            reason: refundReason,
                            idempotencyKey: `admin-refund-${order.id}-${Date.now()}`,
                          }),
                        );
                        setRefundAmount("");
                        setRefundReason("");
                        load();
                      })
                    }
                    className={`${primaryButtonClass} self-start`}
                  >
                    Issue refund
                  </button>
                </div>
              </div>
            )}
          </Card>

          {(isOwner || order.latePaymentFlaggedAt) && (
            <Card title="Late payment">
              {order.latePaymentFlaggedAt ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Flagged {formatDateTime(order.latePaymentFlaggedAt)}</p>
                  {order.latePaymentNote && <p className="mt-0.5 whitespace-pre-wrap">{order.latePaymentNote}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not flagged.</p>
              )}
              {isOwner && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={lateNote}
                    onChange={(e) => setLateNote(e.target.value)}
                    placeholder="Note"
                    aria-label="Late payment note"
                    className={`min-w-0 flex-1 ${inputClass}`}
                  />
                  <button
                    type="button"
                    disabled={isBusy || !lateNote}
                    onClick={() =>
                      withBusy(async () => {
                        const updated = await authorizedFetch((token) =>
                          adminClient.flagLatePayment(token, order.id, lateNote),
                        );
                        setOrder(updated);
                        setLateNote("");
                      })
                    }
                    className={secondaryButtonClass}
                  >
                    Flag
                  </button>
                </div>
              )}
            </Card>
          )}

          <Card title="Details">
            <dl className="flex flex-col gap-2 text-sm">
              <InfoRow label="Placed" value={formatDateTime(order.createdAt)} />
              <InfoRow label="Last updated" value={formatDateTime(order.updatedAt)} />
              <div>
                <dt className="text-xs text-muted-foreground">Customer tracking page</dt>
                <dd>
                  <Link
                    href={`/orders/track/${order.trackingToken}`}
                    target="_blank"
                    className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                  >
                    Open ↗
                  </Link>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-ink" dir="auto">
        {value}
      </dd>
    </div>
  );
}

function ItemMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="hidden sm:block">{label}</dt>
      <dd className={`min-w-0 break-words text-ink ${mono ? "font-mono text-xs" : ""}`}>
        <span className="sm:hidden text-muted-foreground">{label}: </span>
        {value}
      </dd>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-ink">{value}</dd>
    </div>
  );
}

/** Lightweight progress view of the existing status — display only, no workflow logic. */
function FulfillmentTracker({ status }: { status: FulfillmentStatus }) {
  if (status === "CANCELLED") {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
        This order is cancelled.
      </p>
    );
  }
  const current = FULFILLMENT_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={`Fulfillment progress: ${status}`}>
      {FULFILLMENT_STEPS.map((step, index) => {
        const done = index <= current;
        return (
          <li key={step} className="flex flex-col gap-1.5" aria-current={index === current ? "step" : undefined}>
            <span className={`h-1.5 rounded-full ${done ? "bg-ink" : "bg-border"}`} />
            <span
              className={`truncate text-[11px] font-semibold uppercase ${
                index === current ? "text-ink" : done ? "text-muted-foreground" : "text-muted-foreground/60"
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
