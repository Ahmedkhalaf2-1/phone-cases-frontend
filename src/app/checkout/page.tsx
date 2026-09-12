"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCart } from "@/lib/cart/CartProvider";
import { cartClient } from "@/lib/cart/cart-client";
import { ApiError } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { saveOrderCartCredential } from "@/lib/cart/order-credentials";
import { INSTAPAY_RECIPIENT } from "@/config/site";
import type { CheckoutQuote, OrderPaymentMethod, ShippingOption } from "@/lib/cart/types";

const SHIPPING_COUNTRY = "EG";

/**
 * Small non-cryptographic hash (FNV-1a) so we can detect "did the
 * checkout payload actually change" without persisting the payload
 * itself (which would include the customer's name/phone/address) in
 * browser storage.
 */
function hashPayload(payload: unknown): string {
  const str = JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

interface StoredIdempotency {
  key: string;
  payloadHash: string;
}

function idempotencyStorageKey(cartToken: string): string {
  return `checkout-idempotency:${cartToken}`;
}

/**
 * Returns a stable idempotency key for this exact submission. Reusing a
 * key for a genuinely different payload would make the backend reject
 * the retry (`IDEMPOTENCY_KEY_REUSED`), so a payload change gets a new
 * key; retrying the *same* submission (e.g. after a network blip) keeps
 * the same key so the backend's own idempotency handling can recognize
 * it. Only a key + hash are stored — never the payload/address itself.
 */
function getOrCreateIdempotencyKey(cartToken: string, payload: unknown): string {
  const storageKey = idempotencyStorageKey(cartToken);
  const payloadHash = hashPayload(payload);
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const stored = JSON.parse(raw) as StoredIdempotency;
      if (stored.payloadHash === payloadHash) return stored.key;
    }
  } catch {
    // Corrupt/inaccessible storage — fall through to a fresh key.
  }
  const key = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ key, payloadHash } satisfies StoredIdempotency),
    );
  } catch {
    // Storage unavailable (private browsing etc.) — the key still works
    // for this one attempt, it just won't survive a reload.
  }
  return key;
}

function clearIdempotency(cartToken: string) {
  try {
    window.sessionStorage.removeItem(idempotencyStorageKey(cartToken));
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading, source, token, completeCheckout } = useCart();
  const formId = useId();

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingRateId, setShippingRateId] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<CheckoutQuote | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<OrderPaymentMethod>("CASH_ON_DELIVERY");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<
    "idle" | "uploading" | "uploaded" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Switching away from InstaPay must never leave a stale receiptId that
  // could get attached to a Cash on Delivery order.
  function handlePaymentMethodChange(method: OrderPaymentMethod) {
    setPaymentMethod(method);
    if (method !== "INSTAPAY_MANUAL") {
      setReceiptId(null);
      setReceiptStatus("idle");
    }
  }

  useEffect(() => {
    cartClient
      .getShippingOptions(SHIPPING_COUNTRY)
      .then((options) => {
        setShippingOptions(options);
        setShippingRateId(options[0]?.id ?? "");
      })
      .catch((err) =>
        setQuoteError(
          err instanceof ApiError ? err.message : "Could not load shipping options.",
        ),
      );
  }, []);

  // A signature of everything that should invalidate the current quote:
  // shipping choice, or the cart's own contents/coupon changing under us.
  const quoteInputsSignature = useMemo(
    () =>
      JSON.stringify({
        shippingRateId,
        itemsKey: cart?.items.map((i) => `${i.variantId}:${i.quantity}`).join(","),
        couponCode: cart?.coupon?.code ?? null,
      }),
    [shippingRateId, cart],
  );

  useEffect(() => {
    if (!token || !shippingRateId) return;
    let cancelled = false;
    // Starting a fetch is synchronizing with an external system, not
    // mirroring props/state — the loading flag must flip the moment the
    // request starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsQuoteLoading(true);
    cartClient
      .checkoutQuote(token, { country: SHIPPING_COUNTRY, shippingRateId })
      .then((result) => {
        if (cancelled) return;
        setQuoteError(null);
        setQuote(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(
          err instanceof ApiError ? err.message : "Could not calculate totals.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, quoteInputsSignature]);

  async function handleReceiptChange(file: File | null) {
    if (!file || !token) return;
    setReceiptStatus("uploading");
    setReceiptId(null); // don't let a stale receiptId submit while replacing
    try {
      const result = await cartClient.uploadReceipt(token, file);
      setReceiptId(result.receiptId);
      setReceiptStatus("uploaded");
    } catch (err) {
      setReceiptStatus("error");
      setSubmitError(
        err instanceof ApiError ? err.message : "Could not upload the receipt.",
      );
    }
  }

  function buildOrderPayload(expectedTotal: number) {
    return {
      customerFullName: fullName,
      customerEmail: email || undefined,
      customerPhone: phone,
      shippingCountry: SHIPPING_COUNTRY,
      shippingCity: city,
      shippingAddressLine1: addressLine1,
      shippingAddressLine2: addressLine2 || undefined,
      shippingPostalCode: postalCode || undefined,
      shippingRateId,
      expectedTotal,
      paymentMethod,
      receiptId: paymentMethod === "INSTAPAY_MANUAL" ? (receiptId ?? undefined) : undefined,
    };
  }

  async function submitOrder(expectedTotal: number) {
    if (!token) return;
    const payload = buildOrderPayload(expectedTotal);
    const idempotencyKey = getOrCreateIdempotencyKey(token, payload);

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const order = await cartClient.createOrder(token, { idempotencyKey, ...payload });
      // Order is placed — this is the point of no return for "success".
      // Preparing the next cart is housekeeping, not part of order
      // success: its failure must never turn into "could not place order".
      clearIdempotency(token);
      // Preserve the cart credential this order was created from — the
      // rejected-receipt replacement flow on the tracking page needs it,
      // and it won't exist anywhere else once completeCheckout() below
      // replaces the active cart token.
      saveOrderCartCredential(order.trackingToken, token);
      completeCheckout().catch(() => {
        // Best-effort only — the placed order is already safe. A fresh
        // cart will be created lazily next time CartProvider needs one.
      });
      router.push(`/orders/track/${order.trackingToken}?justPlaced=1`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PRICE_CHANGED") {
        const details = err.details as
          | { subtotal: number; discountTotal: number; shippingTotal: number; total: number; currency: string }
          | undefined;
        if (details && quote) {
          setPriceChange({ ...quote, ...details, issues: quote.issues });
        }
        setSubmitError(
          "Prices changed since you loaded this page. Review the new total below and confirm to continue.",
        );
      } else if (err instanceof ApiError && err.kind === "network") {
        setSubmitError(
          "Could not reach the server to confirm your order. If you already tried once, please wait a moment and press Place order again before assuming it failed — retrying is safe and won't create a duplicate order.",
        );
      } else if (err instanceof ApiError && err.code === "ITEMS_UNAVAILABLE") {
        setSubmitError(
          "Some items became unavailable. Go back to your bag to remove them, then return to checkout.",
        );
      } else {
        setSubmitError(
          err instanceof ApiError ? err.message : "Could not place the order. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !shippingRateId || !quote || isQuoteLoading) return;
    if (paymentMethod === "INSTAPAY_MANUAL") {
      if (receiptStatus === "uploading") {
        setSubmitError("Wait for the receipt upload to finish before placing the order.");
        return;
      }
      if (!receiptId) {
        setSubmitError("Upload your InstaPay receipt before placing the order.");
        return;
      }
    }
    await submitOrder(quote.total);
  }

  async function handleConfirmPriceChange() {
    if (!priceChange) return;
    setPriceChange(null);
    setQuote(priceChange);
    await submitOrder(priceChange.total);
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-24">
          <LoadingRow label="Loading…" />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 px-4 py-24 text-center">
          <p className="text-muted-foreground">Your bag is empty.</p>
          <Link
            href="/phone-cases"
            className="mt-4 inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-accent"
          >
            Browse phone cases
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  const quoteIssues = quote?.issues.map((issue) => issue.reason) ?? [];
  const canSubmit =
    !isSubmitting && !isQuoteLoading && !!quote && quoteIssues.length === 0 && !priceChange;

  return (
    <>
      {/* Transactional/private page — never indexed. */}
      <meta name="robots" content="noindex, nofollow" />
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-2 font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">
            Checkout
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Shipping within Egypt only for now.
          </p>

          {source === "demo" && (
            <p className="mb-6 rounded-sm border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              Demo mode — placing this order does not contact a real
              backend. It will produce a demo order you can track locally,
              not a real purchase.
            </p>
          )}

          {quoteIssues.length > 0 && (
            <p className="mb-6 rounded-sm border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent">
              Some items in your bag are unavailable ({quoteIssues.join(", ")}
              ). Go back to your{" "}
              <Link href="/cart" className="underline">
                bag
              </Link>{" "}
              to remove them before checking out.
            </p>
          )}

          {priceChange && (
            <div className="mb-6 rounded-sm border border-accent/40 bg-accent/5 px-4 py-3 text-sm">
              <p className="font-semibold text-accent">
                The price changed since you loaded this page.
              </p>
              <p className="mt-1 text-ink">
                New total: {formatPrice(priceChange.total, priceChange.currency)}
              </p>
              <button
                type="button"
                onClick={handleConfirmPriceChange}
                disabled={isSubmitting}
                className="mt-2 rounded-sm bg-ink px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase enabled:hover:bg-accent disabled:opacity-50"
              >
                Confirm new total &amp; place order
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <fieldset className="flex flex-col gap-4">
                <legend className="font-display text-xl tracking-wide text-ink uppercase">
                  Contact & shipping
                </legend>
                <Field label="Full name" htmlFor={`${formId}-name`}>
                  <input
                    id={`${formId}-name`}
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Email (optional)" htmlFor={`${formId}-email`}>
                  <input
                    id={`${formId}-email`}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone" htmlFor={`${formId}-phone`}>
                  <input
                    id={`${formId}-phone`}
                    required
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="City" htmlFor={`${formId}-city`}>
                  <input
                    id={`${formId}-city`}
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Address line 1" htmlFor={`${formId}-addr1`}>
                  <input
                    id={`${formId}-addr1`}
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Address line 2 (optional)" htmlFor={`${formId}-addr2`}>
                  <input
                    id={`${formId}-addr2`}
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Postal code (optional)" htmlFor={`${formId}-postal`}>
                  <input
                    id={`${formId}-postal`}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="font-display text-xl tracking-wide text-ink uppercase">
                  Shipping method
                </legend>
                {shippingOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-sm border border-border p-3 has-[:checked]:border-accent"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shippingRate"
                        value={option.id}
                        checked={shippingRateId === option.id}
                        onChange={() => setShippingRateId(option.id)}
                        className="accent-accent"
                      />
                      <span>
                        <span className="block font-semibold text-ink">
                          {option.name}
                        </span>
                        {option.estimatedDaysMin !== null && (
                          <span className="block text-xs text-muted-foreground">
                            {option.estimatedDaysMin}–{option.estimatedDaysMax} days
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="font-semibold text-ink">
                      {formatPrice(option.price, option.currency)}
                    </span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="font-display text-xl tracking-wide text-ink uppercase">
                  Payment
                </legend>
                <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-3 has-[:checked]:border-accent">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "CASH_ON_DELIVERY"}
                    onChange={() => handlePaymentMethodChange("CASH_ON_DELIVERY")}
                    className="accent-accent"
                  />
                  Cash on delivery
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-3 has-[:checked]:border-accent">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "INSTAPAY_MANUAL"}
                    onChange={() => handlePaymentMethodChange("INSTAPAY_MANUAL")}
                    className="accent-accent"
                  />
                  InstaPay (manual transfer)
                </label>

                {paymentMethod === "INSTAPAY_MANUAL" && (
                  <InstaPayInstructions
                    amount={quote?.total ?? cart.total}
                    currency={quote?.currency ?? cart.currency}
                    receiptStatus={receiptStatus}
                    onFileChange={handleReceiptChange}
                    formId={formId}
                  />
                )}
              </fieldset>
            </div>

            <div className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5 lg:sticky lg:top-24 lg:self-start">
              <h2 className="font-display text-xl tracking-wide text-ink uppercase">
                Order total
              </h2>
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatPrice(cart.subtotal, cart.currency)}</dd>
                </div>
                {cart.discountTotal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Coupon discount</dt>
                    <dd>−{formatPrice(cart.discountTotal, cart.currency)}</dd>
                  </div>
                )}
                {cart.bundleDiscountTotal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Bundle savings</dt>
                    <dd>−{formatPrice(cart.bundleDiscountTotal, cart.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>
                    {isQuoteLoading
                      ? "…"
                      : quote
                        ? formatPrice(quote.shippingTotal, cart.currency)
                        : "—"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                  <dt>Total</dt>
                  <dd>
                    {isQuoteLoading
                      ? "Recalculating…"
                      : quote
                        ? formatPrice(quote.total, cart.currency)
                        : "—"}
                  </dd>
                </div>
              </dl>

              {quoteError && <p className="text-sm text-accent">{quoteError}</p>}
              {submitError && <p className="text-sm text-accent">{submitError}</p>}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink/40"
              >
                {isSubmitting ? "Placing order…" : isQuoteLoading ? "Calculating total…" : "Place order"}
              </button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

const inputClass =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function InstaPayInstructions({
  amount,
  currency,
  receiptStatus,
  onFileChange,
  formId,
}: {
  amount: number;
  currency: string;
  receiptStatus: "idle" | "uploading" | "uploaded" | "error";
  onFileChange: (file: File | null) => void;
  formId: string;
}) {
  const [copied, setCopied] = useState<"recipient" | "amount" | null>(null);

  async function copy(text: string, which: "recipient" | "amount") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard API unavailable — the value is still shown on screen.
    }
  }

  const recipient = INSTAPAY_RECIPIENT;
  if (!recipient) {
    return (
      <div className="rounded-sm border border-accent/40 bg-accent/5 p-3 text-sm text-accent">
        InstaPay transfer details aren&apos;t configured yet. Please choose
        Cash on delivery, or contact us to arrange payment.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-ink">Transfer instructions</p>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>
          Send to: <strong>{recipient.name}</strong> ({recipient.identifier})
        </span>
        <button
          type="button"
          onClick={() => copy(recipient.identifier, "recipient")}
          className="text-xs font-semibold text-accent underline underline-offset-4"
        >
          {copied === "recipient" ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span>
          Amount: <strong>{formatPrice(amount, currency)}</strong>
        </span>
        <button
          type="button"
          onClick={() => copy((amount / 100).toFixed(2), "amount")}
          className="text-xs font-semibold text-accent underline underline-offset-4"
        >
          {copied === "amount" ? "Copied" : "Copy"}
        </button>
      </div>

      <label htmlFor={`${formId}-receipt`} className="mt-3 block text-sm font-semibold text-ink">
        Upload payment receipt
      </label>
      <input
        id={`${formId}-receipt`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="mt-2 block w-full text-sm"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        JPEG, PNG, or WebP, up to 5MB.
      </p>
      {receiptStatus === "uploading" && (
        <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
      )}
      {receiptStatus === "uploaded" && (
        <p className="mt-1 text-xs text-green-700">
          Receipt uploaded — it will be reviewed by our team after you place
          the order.
        </p>
      )}
      {receiptStatus === "error" && (
        <p className="mt-1 text-xs text-accent">Upload failed — try again.</p>
      )}
    </div>
  );
}
