"use client";

import { use, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReceiptViewer } from "@/components/admin/ReceiptViewer";
import type { AdminOrder, FulfillmentStatus, PaymentStatus } from "@/lib/admin/types";

const FULFILLMENT_VALUES: FulfillmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];
const PAYMENT_VALUES: PaymentStatus[] = ["UNPAID", "PENDING", "PAID", "FAILED"];

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

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Order #{order.sequenceNumber}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.customerFullName} · {order.customerPhone} ·{" "}
        {order.customerEmail ?? "no email"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={order.fulfillmentStatus} />
        <StatusBadge status={order.paymentStatus} />
      </div>

      {actionError && <p className="mt-3 text-sm text-accent">{actionError}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-ink">Fulfillment status</label>
            <select
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
              className="mt-1 block w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {FULFILLMENT_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-ink">
              Payment status {!isOwner && "(OWNER_ADMIN only)"}
            </label>
            <select
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
              className="mt-1 block w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {PAYMENT_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {isOwner && (
            <div>
              <label className="text-sm font-semibold text-ink">
                Flag late payment
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={lateNote}
                  onChange={(e) => setLateNote(e.target.value)}
                  placeholder="Note"
                  className="w-full max-w-xs rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                  className="rounded-2xl border border-border px-3 py-2 text-sm font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Flag
                </button>
              </div>
              {order.latePaymentFlaggedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Flagged {new Date(order.latePaymentFlaggedAt).toLocaleString()}:{" "}
                  {order.latePaymentNote}
                </p>
              )}
            </div>
          )}

          {isOwner && order.receipts.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-ink">Receipts</label>
              {order.receipts.map((receipt) => (
                <div key={receipt.id} className="mt-2 flex items-start gap-3 border-b border-border pb-2 text-sm">
                  <ReceiptViewer receiptId={receipt.id} />
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={receipt.status} />
                    {receipt.rejectionReason && (
                      <p className="text-xs text-muted-foreground">
                        Reason: {receipt.rejectionReason}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(receipt.createdAt).toLocaleString()}
                    </p>
                    {receipt.status === "PENDING_REVIEW" && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason"
                          className="rounded-pill border border-border bg-background px-3 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                          className="rounded-2xl border border-border px-2 py-1 font-semibold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          Reject
                        </button>
                        <span className="text-xs text-muted-foreground">
                          Or mark payment status &quot;PAID&quot; above once verified.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="font-semibold text-ink">Items</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {order.items.map((item) => {
              const returnedQty = item.returns?.reduce(
                (sum: number, r: { quantity: number }) => sum + r.quantity,
                0,
              ) ?? 0;
              const rowState = returnState[item.id] ?? { quantity: "", reason: "" };
              return (
                <li key={item.id} className="border-b border-border pb-2">
                  <div className="flex justify-between">
                    <span>
                      {item.productNameEn} × {item.quantity}
                      {returnedQty > 0 && (
                        <span className="text-muted-foreground"> ({returnedQty} returned)</span>
                      )}
                    </span>
                    <span>{formatPrice(item.lineTotal, order.currency)}</span>
                  </div>
                  {isOwner && returnedQty < item.quantity && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <input
                        type="number"
                        min={1}
                        max={item.quantity - returnedQty}
                        placeholder="Qty"
                        value={rowState.quantity}
                        onChange={(e) =>
                          setReturnState((s) => ({
                            ...s,
                            [item.id]: { ...rowState, quantity: e.target.value },
                          }))
                        }
                        className="w-16 rounded-pill border border-border bg-background px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                      <input
                        placeholder="Return reason"
                        value={rowState.reason}
                        onChange={(e) =>
                          setReturnState((s) => ({
                            ...s,
                            [item.id]: { ...rowState, reason: e.target.value },
                          }))
                        }
                        className="rounded-pill border border-border bg-background px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                      <button
                        type="button"
                        disabled={isBusy || !rowState.quantity || !rowState.reason}
                        onClick={() =>
                          withBusy(async () => {
                            await authorizedFetch((token) =>
                              adminClient.createItemReturn(token, order.id, item.id, {
                                quantity: Number(rowState.quantity),
                                reason: rowState.reason,
                              }),
                            );
                            setReturnState((s) => ({ ...s, [item.id]: { quantity: "", reason: "" } }));
                            load();
                          })
                        }
                        className="rounded-2xl border border-border px-2 py-1 text-xs font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Record return
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-between font-semibold text-ink">
            <span>Total</span>
            <span>{formatPrice(order.total, order.currency)}</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {order.shippingAddressLine1}, {order.shippingCity},{" "}
            {order.shippingCountry}
          </p>

          {isOwner &&
            (order.paymentStatus === "PAID" ||
              order.paymentStatus === "PARTIALLY_REFUNDED") && (
              <div className="mt-4 border-t border-border pt-4">
                <label className="text-sm font-semibold text-ink">Issue refund</label>
                {order.refunds.length > 0 && (
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {order.refunds.map((refund) => (
                      <li key={refund.id}>
                        {formatPrice(refund.amount, refund.currency)} — {refund.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount (minor units)"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-40 rounded-pill border border-border bg-background px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  <input
                    placeholder="Reason"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="rounded-pill border border-border bg-background px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                    className="rounded-pill bg-ink px-3 py-1 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Refund
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
