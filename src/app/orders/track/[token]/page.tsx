"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cartClient, CART_SOURCE } from "@/lib/cart/cart-client";
import { ApiError } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { GuestOrderView } from "@/lib/cart/types";

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const justPlaced = searchParams.get("justPlaced") === "1";

  const [order, setOrder] = useState<GuestOrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    cartClient
      .trackOrder(token)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "No order was found for this tracking link."
              : "Could not load this order.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          {isLoading && <LoadingRow label="Loading order…" />}

          {!isLoading && error && (
            <div className="py-16 text-center">
              <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
                Order not found
              </h1>
              <p className="mt-2 text-muted-foreground">{error}</p>
              <Link
                href="/track"
                className="mt-6 inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-accent"
              >
                Try another tracking link
              </Link>
            </div>
          )}

          {!isLoading && order && (
            <>
              {justPlaced && CART_SOURCE === "demo" && (
                <p className="mb-6 rounded-sm border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent">
                  Demo mode — this is a simulated order confirmation stored
                  only in your browser. No real order was placed and no
                  backend was contacted.
                </p>
              )}
              {justPlaced && CART_SOURCE === "live" && (
                <p className="mb-6 rounded-sm border border-border bg-surface px-4 py-3 text-sm text-ink">
                  Thank you — your order was placed.
                </p>
              )}

              <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">
                Order {order.orderNumber}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Placed {new Date(order.createdAt).toLocaleString()}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <OrderStatusBadge label="Fulfillment" value={order.fulfillmentStatus} />
                <OrderStatusBadge label="Payment" value={order.paymentStatus} />
              </div>

              {order.receipts.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  Receipt:
                  <StatusBadge status={order.receipts[order.receipts.length - 1].status} />
                  {order.receipts[order.receipts.length - 1].rejectionReason && (
                    <span>— {order.receipts[order.receipts.length - 1].rejectionReason}</span>
                  )}
                </div>
              )}

              <div className="mt-8 grid gap-10 lg:grid-cols-3">
                <ul className="flex flex-col gap-3 lg:col-span-2">
                  {order.items.map((item, index) => (
                    <li
                      key={`${item.sku}-${index}`}
                      className="flex items-center justify-between border-b border-border pb-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-ink">{item.productName}</p>
                        <p className="text-muted-foreground">
                          {[item.phoneModelName, item.caseTypeName]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-ink">
                        {formatPrice(item.lineTotal, order.currency)}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-5">
                  <h2 className="font-display text-lg tracking-wide text-ink uppercase">
                    Shipping to
                  </h2>
                  <p className="text-sm text-ink">
                    {order.shippingAddress.fullName}
                    <br />
                    {order.shippingAddress.addressLine1}
                    {order.shippingAddress.addressLine2 && (
                      <>
                        <br />
                        {order.shippingAddress.addressLine2}
                      </>
                    )}
                    <br />
                    {order.shippingAddress.city}, {order.shippingAddress.country}
                    <br />
                    {order.shippingAddress.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.shippingRateName}
                  </p>
                  <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd>{formatPrice(order.subtotal, order.currency)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Shipping</dt>
                      <dd>{formatPrice(order.shippingTotal, order.currency)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-ink">
                      <dt>Total</dt>
                      <dd>{formatPrice(order.total, order.currency)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function OrderStatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {label}: <StatusBadge status={value} />
    </span>
  );
}
