"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CartLineThumbnail } from "@/components/catalog/CartLineThumbnail";
import { useCart } from "@/lib/cart/CartProvider";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { TickValue } from "@/components/motion/TickValue";
import { BundleProgressNotice } from "@/components/bundles/BundleProgressNotice";
import { getProductBySlug } from "@/lib/data/products";
import type { PublicVariant } from "@/lib/api/types";

/** Matches --sf-dur-normal (240ms) plus a small margin. */
const ROW_EXIT_MS = 260;

type CartLine = NonNullable<ReturnType<typeof useCart>["cart"]>["items"][number];

interface ExitingRow {
  item: CartLine;
  index: number;
  startedAt: number;
}

export default function CartPage() {
  const {
    cart,
    isLoading,
    error,
    source,
    updateItemQuantity,
    removeItem,
    replaceVariant,
    applyCoupon,
    removeCoupon,
    retryInit,
  } = useCart();
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Rows being removed. The removal request is sent immediately (the server
  // stays authoritative); this only keeps the row on screen long enough to
  // collapse smoothly instead of vanishing the moment the response lands.
  const [exiting, setExiting] = useState<Record<string, ExitingRow>>({});

  useEffect(() => {
    if (!cart) return;
    const timers = Object.entries(exiting)
      .filter(([id]) => !cart.items.some((item) => item.id === id))
      .map(([id, row]) =>
        setTimeout(
          () =>
            setExiting((prev) => {
              const rest = { ...prev };
              delete rest[id];
              return rest;
            }),
          Math.max(0, ROW_EXIT_MS - (Date.now() - row.startedAt)),
        ),
      );
    return () => timers.forEach(clearTimeout);
  }, [cart, exiting]);

  function handleRemove(item: CartLine, index: number) {
    setExiting((prev) => ({ ...prev, [item.id]: { item, index, startedAt: Date.now() } }));
    removeItem(item.id).catch(() => {
      // Failed: bring the row back (the cart context already carries the error).
      setExiting((prev) => {
        const rest = { ...prev };
        delete rest[item.id];
        return rest;
      });
    });
  }

  const rows: { item: CartLine; leaving: boolean }[] = (cart?.items ?? []).map((item) => ({
    item,
    leaving: item.id in exiting,
  }));
  for (const [id, row] of Object.entries(exiting)) {
    if (!rows.some((r) => r.item.id === id)) {
      rows.splice(Math.min(row.index, rows.length), 0, { item: row.item, leaving: true });
    }
  }

  return (
    <>
      {/* Transactional/private page — never indexed. */}
      <meta name="robots" content="noindex, nofollow" />
      <SiteHeader />
      <main data-motion="page" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-6 font-display text-4xl tracking-tighter text-ink sm:text-5xl">
            Your bag
          </h1>

          {source === "demo" && (
            <p className="mb-6 rounded-pill bg-surface px-4 py-3 text-sm text-muted-foreground shadow-soft">
              Demo mode — this cart is simulated locally in your browser
              (backend offline). It is not a real order.
            </p>
          )}

          {isLoading && <LoadingRow label="Loading your bag…" />}

          {!isLoading && error && (
            <div className="flex items-center justify-between gap-4 rounded-pill bg-accent/5 px-4 py-3 text-sm text-accent">
              <span>{error}</span>
              {!cart && (
                <button
                  type="button"
                  onClick={retryInit}
                  className="shrink-0 font-semibold underline underline-offset-4"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {!isLoading && cart && cart.items.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">Your bag is empty.</p>
              <Link
                href="/collections"
                className="mt-4 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Browse phone cases
              </Link>
            </div>
          )}

          {!isLoading && cart && cart.items.length > 0 && (
            <BundleProgressNotice
              progress={cart.bundleProgress}
              bundleDiscountTotal={cart.bundleDiscountTotal}
              currency={cart.currency}
              onRemoveCoupon={() => removeCoupon().catch(() => {})}
            />
          )}

          {!isLoading && cart && cart.items.length > 0 && (
            <div className="sf-fade-in grid gap-10 lg:grid-cols-3 lg:gap-12">
              <ul className="flex flex-col gap-4 lg:col-span-2">
                {rows.map(({ item, leaving }, rowIndex) => (
                  <li
                    key={item.id}
                    data-leaving={leaving}
                    inert={leaving}
                    className="sf-collapsible"
                  >
                    <div className={`min-h-0 ${leaving ? "overflow-hidden" : ""}`}>
                      <div className="flex gap-4 border-b border-border pb-4">
                        <CartLineThumbnail
                          productSlug={item.productSlug}
                          thumbnail={item.thumbnail}
                        />
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link
                                href={`/products/${item.productSlug}`}
                                className="font-semibold text-ink hover:text-accent"
                              >
                                {item.productName}
                              </Link>
                              <p className="text-sm text-muted-foreground">
                                {[item.phoneModel?.name, item.caseType?.name]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {(item.isPersonalized || item.customDesignId) && (
                                <p className="mt-1 inline-block rounded-full bg-accent-wash px-2 py-0.5 text-xs font-semibold text-ink">
                                  Your own design
                                  {item.customizationPrice
                                    ? ` · includes ${formatPrice(item.customizationPrice, cart.currency)}`
                                    : ""}
                                </p>
                              )}
                              {item.note && (
                                <p className="mt-1 text-xs text-ink/80 italic whitespace-pre-wrap" dir="auto">
                                  Note: {item.note}
                                </p>
                              )}
                              {!item.isAvailable && (
                                <p className="mt-1 text-xs font-semibold text-accent uppercase">
                                  {item.unavailableReason ?? "Unavailable"} —
                                  excluded from your total
                                </p>
                              )}
                            </div>
                            <p className="font-semibold whitespace-nowrap text-ink">
                              <TickValue value={item.lineSubtotal}>
                                {formatPrice(item.lineSubtotal, cart.currency)}
                              </TickValue>
                            </p>
                          </div>

                          <div className="mt-2 flex items-center gap-4">
                            <div className="flex items-center rounded-pill border border-border">
                              <button
                                type="button"
                                onClick={() =>
                                  updateItemQuantity(item.id, item.quantity - 1).catch(() => {})
                                }
                                disabled={item.quantity <= 1}
                                aria-label="Decrease quantity"
                                className="min-h-11 min-w-11 px-2.5 py-1 text-ink hover:text-accent disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-sm" aria-label="Quantity">
                                <TickValue value={item.quantity}>{item.quantity}</TickValue>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateItemQuantity(item.id, item.quantity + 1).catch(() => {})
                                }
                                disabled={item.quantity >= 20}
                                aria-label="Increase quantity"
                                className="min-h-11 min-w-11 px-2.5 py-1 text-ink hover:text-accent disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              >
                                +
                              </button>
                            </div>
                            {(item.phoneModel || item.caseType) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingItemId((id) => (id === item.id ? null : item.id))
                                }
                                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              >
                                {editingItemId === item.id ? "Cancel" : "Change"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemove(item, rowIndex)}
                              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              Remove
                            </button>
                          </div>

                          {editingItemId === item.id && (
                            <CartItemVariantEditor
                              productSlug={item.productSlug}
                              currentVariantId={item.variantId}
                              onSelect={(variantId) => {
                                replaceVariant(item.id, variantId)
                                  .then(() => setEditingItemId(null))
                                  .catch(() => {});
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:self-start">
                <h2 className="font-display text-xl tracking-tight text-ink">
                  Summary
                </h2>

                {cart.coupon ? (
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Coupon <strong>{cart.coupon.code}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCoupon().catch(() => {})}
                      className="text-muted-foreground underline underline-offset-4 hover:text-accent"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!couponInput.trim()) return;
                      setCouponBusy(true);
                      try {
                        await applyCoupon(couponInput.trim());
                        setCouponInput("");
                      } catch {
                        // cart context `error` already carries the message.
                      } finally {
                        setCouponBusy(false);
                      }
                    }}
                    className="flex gap-2"
                  >
                    <label htmlFor="coupon" className="sr-only">
                      Coupon code
                    </label>
                    <input
                      id="coupon"
                      value={couponInput}
                      onChange={(event) => setCouponInput(event.target.value)}
                      placeholder="Coupon code"
                      className="w-full rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                    <button
                      type="submit"
                      disabled={couponBusy}
                      className="rounded-pill border border-border px-3 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {cart.couponWarning && (
                  <p className="text-xs text-accent">{cart.couponWarning}</p>
                )}
                {source === "demo" && !cart.coupon && (
                  <p className="text-xs text-muted-foreground">
                    Try demo code <strong>WELCOME10</strong>.
                  </p>
                )}

                <dl className="flex flex-col gap-1.5 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{formatPrice(cart.subtotal, cart.currency)}</dd>
                  </div>
                  {cart.discountTotal > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Discount</dt>
                      <dd>−{formatPrice(cart.discountTotal, cart.currency)}</dd>
                    </div>
                  )}
                  {cart.bundleDiscountTotal > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Bundle discount</dt>
                      <dd>
                        −{formatPrice(cart.bundleDiscountTotal, cart.currency)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                    <dt>Total</dt>
                    <dd>{formatPrice(cart.total, cart.currency)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Shipping is calculated at checkout.
                </p>

                <Link
                  href="/checkout"
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-pill bg-ink px-6 py-3.5 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Checkout
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Lets a customer move an existing line item to a different phone
 * model / case type via the backend's atomic
 * `PATCH /cart/items/:id/variant` — a single replace, not a
 * remove-then-add pair that would briefly show an inconsistent cart.
 */
function CartItemVariantEditor({
  productSlug,
  currentVariantId,
  onSelect,
}: {
  productSlug: string;
  currentVariantId: string;
  onSelect: (variantId: string) => void;
}) {
  const [variants, setVariants] = useState<PublicVariant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductBySlug(productSlug)
      .then((result) => {
        if (cancelled) return;
        setVariants(result?.product.variants ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load other options for this product.");
      });
    return () => {
      cancelled = true;
    };
  }, [productSlug]);

  if (error) return <p className="mt-2 text-xs text-accent">{error}</p>;
  if (!variants) return <p className="mt-2 text-xs text-muted-foreground">Loading options…</p>;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {variants.map((variant) => (
        <button
          key={variant.id}
          type="button"
          disabled={!variant.isAvailable || variant.id === currentVariantId}
          onClick={() => onSelect(variant.id)}
          className={`rounded-pill border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            variant.id === currentVariantId
              ? "border-accent text-accent"
              : "border-border text-ink hover:border-accent hover:text-accent"
          }`}
        >
          {[variant.phoneModel?.name, variant.caseType?.name].filter(Boolean).join(" · ") ||
            variant.sku}
          {!variant.isAvailable && " (out of stock)"}
        </button>
      ))}
    </div>
  );
}
