"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cartClient, CART_SOURCE } from "@/lib/cart/cart-client";
import { getOrderCartCredential } from "@/lib/cart/order-credentials";
import { ApiError } from "@/lib/api/http";
import { useI18n } from "@/i18n/I18nProvider";
import { useFormatPrice } from "@/i18n/useFormatPrice";
import { formatDateTimeFor } from "@/i18n/format";
import { apiErrorMessage } from "@/i18n/api-errors";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { GuestOrderView } from "@/lib/cart/types";

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { t, locale } = useI18n();
  const formatPrice = useFormatPrice();
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
          ? t("orders.notFoundBody")
          : t("orders.loadError"),
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
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          {isLoading && <LoadingRow label={t("orders.loadingOrder")} />}

          {!isLoading && error && (
            <div className="py-16 text-center">
              <h1 className="font-display text-3xl tracking-tighter text-ink">
                {t("orders.notFoundTitle")}
              </h1>
              <p className="mt-2 text-muted-foreground">{error}</p>
              <Link
                href="/track"
                className="mt-6 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent"
              >
                {t("orders.tryAnother")}
              </Link>
            </div>
          )}

          {!isLoading && order && (
            <>
              {justPlaced && CART_SOURCE === "demo" && (
                <p className="mb-6 rounded-pill bg-accent/5 px-4 py-3 text-sm text-accent">
                  {t("orders.demoPlaced")}
                </p>
              )}
              {justPlaced && CART_SOURCE === "live" && (
                <p className="mb-6 rounded-pill bg-surface px-4 py-3 text-sm text-ink shadow-soft">
                  {t("orders.thanks")}
                </p>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">
                    {t("orders.orderNumber", { number: order.orderNumber })}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("orders.placed", { date: formatDateTimeFor(locale, order.createdAt) })}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {t("orders.trackingTokenLabel")} <code dir="ltr" className="font-mono text-ink">{token}</code>
                    </span>
                    <button
                      type="button"
                      onClick={copyToken}
                      className="font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {tokenCopied ? t("common.copied") : t("orders.copyToken")}
                    </button>
                  </div>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    {t("orders.saveTokenBefore")}{" "}
                    <Link href="/track" className="underline underline-offset-4 hover:text-accent">
                      {t("orders.trackTitle")}
                    </Link>{" "}
                    {t("orders.saveTokenAfter")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-pill border border-border px-3 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {copied ? t("orders.linkCopied") : t("orders.copyLink")}
                  </button>
                  <button
                    type="button"
                    onClick={() => load()}
                    disabled={isRefreshing}
                    className="rounded-pill border border-border px-3 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {isRefreshing ? t("orders.refreshing") : t("orders.refresh")}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <OrderStatusBadge label={t("orders.fulfillment")} value={order.fulfillmentStatus} />
                <OrderStatusBadge label={t("orders.payment")} value={order.paymentStatus} />
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
                        {item.hasCustomDesign && (
                          <p className="mt-1 inline-block rounded-full bg-accent-wash px-2 py-0.5 text-xs font-semibold text-ink">
                            {t("common.yourOwnDesign")}
                          </p>
                        )}
                        {item.note && (
                          <p className="mt-1 text-xs text-ink/80 italic whitespace-pre-wrap" dir="auto">
                            {t("common.note")}: {item.note}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold text-ink">
                        {formatPrice(item.lineTotal, order.currency)}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
                  <h2 className="font-display text-lg tracking-tight text-ink">
                    {t("orders.shippingTo")}
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
                    <bdi dir="ltr">{order.shippingAddress.phone}</bdi>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.shippingRateName}
                  </p>
                  {order.customerNote && (
                    <div className="border-t border-border pt-3">
                      <h3 className="font-display text-sm tracking-tight text-ink uppercase">
                        {t("orders.orderNotes")}
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/90" dir="auto">
                        {order.customerNote}
                      </p>
                    </div>
                  )}
                  <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("common.subtotal")}</dt>
                      <dd>{formatPrice(order.subtotal, order.currency)}</dd>
                    </div>
                    {order.discountTotal > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{t("common.couponDiscount")}</dt>
                        <dd>−{formatPrice(order.discountTotal, order.currency)}</dd>
                      </div>
                    )}
                    {order.bundleDiscountTotal > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{t("common.bundleDiscount")}</dt>
                        <dd>−{formatPrice(order.bundleDiscountTotal, order.currency)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("common.shipping")}</dt>
                      <dd>{formatPrice(order.shippingTotal, order.currency)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-ink">
                      <dt>{t("common.total")}</dt>
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
  const { t, locale } = useI18n();
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
        apiErrorMessage(err, { t, locale }, "orders.replacementError"),
      );
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {t("orders.receipt")}
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
                {t("orders.uploadReplacement")}
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
                <p className="mt-1 text-xs text-muted-foreground">{t("orders.uploading")}</p>
              )}
              {status === "error" && uploadError && (
                <p className="mt-1 text-xs text-accent">{uploadError}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-accent">
              {t("orders.noSession")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
