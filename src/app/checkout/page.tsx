"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCart } from "@/lib/cart/CartProvider";
import { cartClient } from "@/lib/cart/cart-client";
import { ApiError } from "@/lib/api/http";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import type { OrderPaymentMethod, ShippingOption } from "@/lib/cart/types";

const SHIPPING_COUNTRY = "EG";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading, source, token, completeCheckout } = useCart();
  const formId = useId();

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingRateId, setShippingRateId] = useState("");
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [quoteShipping, setQuoteShipping] = useState<number | null>(null);
  const [quoteIssues, setQuoteIssues] = useState<string[]>([]);
  const [quoteError, setQuoteError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!token || !shippingRateId) return;
    let cancelled = false;
    cartClient
      .checkoutQuote(token, { country: SHIPPING_COUNTRY, shippingRateId })
      .then((quote) => {
        if (cancelled) return;
        setQuoteError(null);
        setQuoteTotal(quote.total);
        setQuoteShipping(quote.shippingTotal);
        setQuoteIssues(quote.issues.map((issue) => issue.reason));
      })
      .catch((err) => {
        if (cancelled) return;
        setQuoteError(
          err instanceof ApiError ? err.message : "Could not calculate totals.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, shippingRateId]);

  async function handleReceiptChange(file: File | null) {
    if (!file || !token) return;
    setReceiptStatus("uploading");
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !shippingRateId || quoteTotal === null) return;
    if (paymentMethod === "INSTAPAY_MANUAL" && !receiptId) {
      setSubmitError("Upload your InstaPay receipt before placing the order.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const order = await cartClient.createOrder(token, {
        idempotencyKey: crypto.randomUUID(),
        customerFullName: fullName,
        customerEmail: email || undefined,
        customerPhone: phone,
        shippingCountry: SHIPPING_COUNTRY,
        shippingCity: city,
        shippingAddressLine1: addressLine1,
        shippingAddressLine2: addressLine2 || undefined,
        shippingPostalCode: postalCode || undefined,
        shippingRateId,
        expectedTotal: quoteTotal,
        paymentMethod,
        receiptId: receiptId ?? undefined,
      });
      await completeCheckout();
      router.push(`/orders/track/${order.trackingToken}?justPlaced=1`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Could not place the order. Please try again.",
      );
      setIsSubmitting(false);
    }
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

  return (
    <>
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
                    onChange={() => setPaymentMethod("CASH_ON_DELIVERY")}
                    className="accent-accent"
                  />
                  Cash on delivery
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-3 has-[:checked]:border-accent">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "INSTAPAY_MANUAL"}
                    onChange={() => setPaymentMethod("INSTAPAY_MANUAL")}
                    className="accent-accent"
                  />
                  InstaPay (upload receipt)
                </label>

                {paymentMethod === "INSTAPAY_MANUAL" && (
                  <div className="rounded-sm border border-border bg-surface p-3">
                    <label htmlFor={`${formId}-receipt`} className="text-sm font-semibold text-ink">
                      Upload payment receipt
                    </label>
                    <input
                      id={`${formId}-receipt`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handleReceiptChange(e.target.files?.[0] ?? null)
                      }
                      className="mt-2 block w-full text-sm"
                    />
                    {receiptStatus === "uploading" && (
                      <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
                    )}
                    {receiptStatus === "uploaded" && (
                      <p className="mt-1 text-xs text-green-700">Receipt uploaded.</p>
                    )}
                  </div>
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
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd>−{formatPrice(cart.discountTotal, cart.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>
                    {quoteShipping !== null
                      ? formatPrice(quoteShipping, cart.currency)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                  <dt>Total</dt>
                  <dd>
                    {quoteTotal !== null
                      ? formatPrice(quoteTotal, cart.currency)
                      : "—"}
                  </dd>
                </div>
              </dl>

              {quoteError && <p className="text-sm text-accent">{quoteError}</p>}
              {submitError && <p className="text-sm text-accent">{submitError}</p>}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  quoteTotal === null ||
                  quoteIssues.length > 0 ||
                  !shippingRateId
                }
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-sm font-semibold tracking-wide text-white uppercase transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink/40"
              >
                {isSubmitting ? "Placing order…" : "Place order"}
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
