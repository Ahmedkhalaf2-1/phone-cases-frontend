"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cartClient, CART_SOURCE } from "@/lib/cart/cart-client";
import { getOrderCartCredential } from "@/lib/cart/order-credentials";
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  async function load() {
    if (loaded) setIsRefreshing(true);
    try {
      const result = await cartClient.trackOrder(token);
      setOrder(result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "No order was found for this tracking link."
          : "Could not load this order.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Intentionally runs once per `token` — `load` closes over state
    // setters that are stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the link is still visible/selectable in the address bar.
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the token is still visible on screen.
    }
  }

  return (
    <>
      {/* Contains a secret tracking token — must never be indexed. */}
      <meta name="robots" content="noindex, nofollow" />
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          {isLoading && <LoadingRow label="Loading order…" />}

          {!isLoading && error && (
            <div className="py-16 text-center">
              <h1 className="font-display text-3xl tracking-tighter text-ink">
                Order not found
              </h1>
              <p className="mt-2 text-muted-foreground">{error}</p>
              <Link
                href="/track"
                className="mt-6 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent"
              >
                Try another tracking link
              </Link>
            </div>
          )}

          {!isLoading && order && (
            <>
              {justPlaced && CART_SOURCE === "demo" && (
                <p className="mb-6 rounded-pill bg-accent/5 px-4 py-3 text-sm text-accent">
                  Demo mode — this is a simulated order confirmation stored
                  only in your browser. No real order was placed and no
                  backend was contacted.
                </p>
              )}
              {justPlaced && CART_SOURCE === "live" && (
                <p className="mb-6 rounded-pill bg-surface px-4 py-3 text-sm text-ink shadow-soft">
                  Thank you — your order was placed.
                </p>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">
                    Order {order.orderNumber}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Placed {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Tracking token: <code className="font-mono text-ink">{token}</code>
                    </span>
                    <button
                      type="button"
                      onClick={copyToken}
                      className="font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {tokenCopied ? "Copied" : "Copy token"}
                    </button>
                  </div>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Save this token — it&apos;s what you enter on the{" "}
                    <Link href="/track" className="underline underline-offset-4 hover:text-accent">
                      Track order
                    </Link>{" "}
                    page (the order number above won&apos;t work there).
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-pill border border-border px-3 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {copied ? "Link copied" : "Copy tracking link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => load()}
                    disabled={isRefreshing}
                    className="rounded-pill border border-border px-3 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {isRefreshing ? "Refreshing…" : "Refresh status"}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <OrderStatusBadge label="Fulfillment" value={order.fulfillmentStatus} />
                <OrderStatusBadge label="Payment" value={order.paymentStatus} />
              </div>

              {order.receipts.length > 0 && (
                <ReceiptSection
                  trackingToken={token}
                  order={order}
                  onReplaced={load}
                />
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

                <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
                  <h2 className="font-display text-lg tracking-tight text-ink">
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
                    {order.discountTotal > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Coupon discount</dt>
                        <dd>−{formatPrice(order.discountTotal, order.currency)}</dd>
                      </div>
                    )}
                    {order.bundleDiscountTotal > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Bundle savings</dt>
                        <dd>−{formatPrice(order.bundleDiscountTotal, order.currency)}</dd>
                      </div>
                    )}
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
    <span className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-muted-foreground uppercase">
      {label}: <StatusBadge status={value} />
    </span>
  );
}

/**
 * Shows the latest receipt's review status, and — only when it was
 * rejected — a way to upload a replacement. Replacement requires the
 * original cart's credential (see `order-credentials.ts`); if it isn't
 * available on this device/browser, this shows an honest limitation
 * instead of a fake "replaced" success.
 */
function ReceiptSection({
  trackingToken,
  order,
  onReplaced,
}: {
  trackingToken: string;
  order: GuestOrderView;
  onReplaced: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const latest = order.receipts[order.receipts.length - 1];
  const cartCredential = getOrderCartCredential(trackingToken);

  async function handleReplace(file: File | null) {
    if (!file) return;
    if (!cartCredential) return; // guarded by the disabled input below too
    setStatus("uploading");
    setUploadError(null);
    try {
      await cartClient.replaceReceipt(cartCredential, file);
      setStatus("idle");
      onReplaced();
    } catch (err) {
      setStatus("error");
      setUploadError(
        err instanceof ApiError ? err.message : "Could not upload the replacement receipt.",
      );
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Receipt:
        <StatusBadge status={latest.status} />
        {latest.rejectionReason && <span>— {latest.rejectionReason}</span>}
      </div>

      {latest.status === "REJECTED" && (
        <div className="mt-2 rounded-2xl bg-accent/5 p-3">
          {cartCredential ? (
            <>
              <label
                htmlFor="replacement-receipt"
                className="text-sm font-semibold text-ink"
              >
                Upload a replacement receipt
              </label>
              <input
                id="replacement-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={status === "uploading"}
                onChange={(e) => handleReplace(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm"
              />
              {status === "uploading" && (
                <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
              )}
              {status === "error" && uploadError && (
                <p className="mt-1 text-xs text-accent">{uploadError}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-accent">
              We can&apos;t confirm this browser has the original checkout
              session needed to securely accept a replacement receipt for
              this order. Please contact us for help resolving payment on
              this order.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
