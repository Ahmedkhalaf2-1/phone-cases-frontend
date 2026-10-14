"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useCart } from "@/lib/cart/CartProvider";
import { cartClient } from "@/lib/cart/cart-client";
import { ApiError } from "@/lib/api/http";
import { useI18n } from "@/i18n/I18nProvider";
import { useFormatPrice } from "@/i18n/useFormatPrice";
import { apiErrorMessage } from "@/i18n/api-errors";
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
  const { t, locale } = useI18n();
  // Latest translator for async error text, without re-running effects when
  // the language changes (which must never reset the shipping choice).
  const i18nRef = useRef({ t, locale });
  useEffect(() => {
    i18nRef.current = { t, locale };
  }, [t, locale]);
  const formatPrice = useFormatPrice();
  const { cart, isLoading, source, token, completeCheckout } = useCart();
  const formId = useId();

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [isShippingLoading, setIsShippingLoading] = useState(true);
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
  const [customerNote, setCustomerNote] = useState("");
  const [customerNoteError, setCustomerNoteError] = useState<string | null>(null);
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
      .getShippingOptions(SHIPPING_COUNTRY, locale)
      .then((options) => {
        setShippingOptions(options);
        // Keep the customer's choice when only the language changed.
        setShippingRateId((current) =>
          options.some((option) => option.id === current) ? current : (options[0]?.id ?? ""),
        );
      })
      .catch((err) =>
        setQuoteError(
          apiErrorMessage(err, i18nRef.current, "checkout.errors.shippingLoad"),
        ),
      )
      .finally(() => setIsShippingLoading(false));
  }, [locale]);

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
          apiErrorMessage(err, { t, locale }, "checkout.errors.totals"),
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
        apiErrorMessage(err, { t, locale }, "checkout.errors.receiptUpload"),
      );
    }
  }

  function buildOrderPayload(expectedTotal: number) {
    const trimmedNote = customerNote.trim();
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
      customerNote: trimmedNote ? trimmedNote : undefined,
    };
  }

  async function submitOrder(expectedTotal: number) {
    if (!token) return;
    if (customerNote.trim().length > 1000) {
      setCustomerNoteError(t("checkout.errors.noteTooLong"));
      return;
    }
    const payload = buildOrderPayload(expectedTotal);
    const idempotencyKey = getOrCreateIdempotencyKey(token, payload);

    setIsSubmitting(true);
    setSubmitError(null);
    setCustomerNoteError(null);
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
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("customerNote")
      ) {
        setCustomerNoteError(t("checkout.errors.noteTooLong"));
      } else if (err instanceof ApiError && err.code === "PRICE_CHANGED") {
        const details = err.details as
          | { subtotal: number; discountTotal: number; shippingTotal: number; total: number; currency: string }
          | undefined;
        if (details && quote) {
          setPriceChange({ ...quote, ...details, issues: quote.issues });
        }
        setSubmitError(t("checkout.errors.priceChanged"));
      } else if (err instanceof ApiError && err.kind === "network") {
        setSubmitError(t("checkout.errors.network"));
      } else if (err instanceof ApiError && err.code === "ITEMS_UNAVAILABLE") {
        setSubmitError(t("checkout.errors.itemsUnavailable"));
      } else {
        setSubmitError(apiErrorMessage(err, { t, locale }, "checkout.errors.placeOrder"));
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
        setSubmitError(t("checkout.errors.waitUpload"));
        return;
      }
      if (!receiptId) {
        setSubmitError(t("checkout.errors.needReceipt"));
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
          <LoadingRow label={t("common.loading")} />
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
          <p className="text-muted-foreground">{t("cart.empty")}</p>
          <Link
            href="/collections"
            className="mt-4 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent"
          >
            {t("cart.browse")}
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
      <main data-motion="quiet" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-2 font-display text-4xl tracking-tighter text-ink sm:text-5xl">
            {t("checkout.title")}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("checkout.egyptOnly")}
          </p>

          {source === "demo" && (
            <p className="mb-6 rounded-pill bg-surface px-4 py-3 text-sm text-muted-foreground shadow-soft">
              {t("checkout.demoNotice")}
            </p>
          )}

          {quoteIssues.length > 0 && (
            <p className="mb-6 rounded-pill bg-accent/5 px-4 py-3 text-sm text-accent">
              {t("checkout.unavailableBefore", { issues: quoteIssues.join(", ") })}{" "}
              <Link href="/cart" className="underline">
                {t("checkout.bag")}
              </Link>{" "}
              {t("checkout.unavailableAfter")}
            </p>
          )}

          {priceChange && (
            <div className="mb-6 rounded-2xl bg-accent/5 px-4 py-3 text-sm shadow-soft">
              <p className="font-semibold text-accent">
                {t("checkout.priceChanged")}
              </p>
              <p className="mt-1 text-ink">
                {t("checkout.newTotal", { price: formatPrice(priceChange.total, priceChange.currency) })}
              </p>
              <button
                type="button"
                onClick={handleConfirmPriceChange}
                disabled={isSubmitting}
                className="mt-2 rounded-pill bg-ink px-4 py-2 text-xs font-medium tracking-tight text-white enabled:hover:bg-accent disabled:opacity-50"
              >
                {t("checkout.confirmNewTotal")}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-3 lg:gap-12">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <fieldset className="flex flex-col gap-4">
                <legend className="font-display text-xl tracking-tight text-ink">
                  {t("checkout.contactShipping")}
                </legend>
                <Field label={t("checkout.fullName")} htmlFor={`${formId}-name`}>
                  <input
                    id={`${formId}-name`}
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("checkout.emailOptional")} htmlFor={`${formId}-email`}>
                  <input
                    id={`${formId}-email`}
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("checkout.phone")} htmlFor={`${formId}-phone`}>
                  <input
                    id={`${formId}-phone`}
                    required
                    placeholder={t("checkout.phonePlaceholder")}
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("checkout.city")} htmlFor={`${formId}-city`}>
                  <input
                    id={`${formId}-city`}
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("checkout.addressLine1")} htmlFor={`${formId}-addr1`}>
                  <input
                    id={`${formId}-addr1`}
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("checkout.addressLine2")} htmlFor={`${formId}-addr2`}>
                  <input
                    id={`${formId}-addr2`}
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("checkout.postalCode")} htmlFor={`${formId}-postal`}>
                  <input
                    id={`${formId}-postal`}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={t("checkout.orderNotes")}
                  htmlFor={`${formId}-note`}
                >
                  <textarea
                    id={`${formId}-note`}
                    dir="auto"
                    rows={3}
                    maxLength={1000}
                    placeholder={t("checkout.orderNotesPlaceholder")}
                    value={customerNote}
                    onChange={(e) => {
                      setCustomerNote(e.target.value);
                      if (customerNoteError) setCustomerNoteError(null);
                    }}
                    className={`${textareaClass} ${
                      customerNoteError ? "border-accent ring-1 ring-accent" : ""
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs">
                    {customerNoteError ? (
                      <span className="text-accent">{customerNoteError}</span>
                    ) : (
                      <span />
                    )}
                    <span className="text-muted-foreground ms-auto">
                      {customerNote.length} / 1000
                    </span>
                  </div>
                </Field>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="font-display text-xl tracking-tight text-ink">
                  {t("checkout.shippingMethod")}
                </legend>
                {shippingOptions.length === 0 && !isShippingLoading && (
                  <p className="text-sm text-accent">
                    {t("checkout.noShipping")}
                  </p>
                )}
                {shippingOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border p-3 has-[:checked]:border-accent"
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
                            {t("checkout.days", { min: option.estimatedDaysMin, max: option.estimatedDaysMax ?? option.estimatedDaysMin })}
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
                <legend className="font-display text-xl tracking-tight text-ink">
                  {t("checkout.payment")}
                </legend>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-3 has-[:checked]:border-accent">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "CASH_ON_DELIVERY"}
                    onChange={() => handlePaymentMethodChange("CASH_ON_DELIVERY")}
                    className="accent-accent"
                  />
                  {t("checkout.cod")}
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-3 has-[:checked]:border-accent">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "INSTAPAY_MANUAL"}
                    onChange={() => handlePaymentMethodChange("INSTAPAY_MANUAL")}
                    className="accent-accent"
                  />
                  {t("checkout.instapay")}
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

            <div className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:self-start">
              <h2 className="font-display text-xl tracking-tight text-ink">
                {t("checkout.orderTotal")}
              </h2>
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("common.subtotal")}</dt>
                  <dd>{formatPrice(cart.subtotal, cart.currency)}</dd>
                </div>
                {cart.discountTotal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("common.couponDiscount")}</dt>
                    <dd>−{formatPrice(cart.discountTotal, cart.currency)}</dd>
                  </div>
                )}
                {cart.bundleDiscountTotal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("common.bundleDiscount")}</dt>
                    <dd>−{formatPrice(cart.bundleDiscountTotal, cart.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("common.shipping")}</dt>
                  <dd>
                    {isQuoteLoading
                      ? "…"
                      : quote
                        ? formatPrice(quote.shippingTotal, cart.currency)
                        : "—"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                  <dt>{t("common.total")}</dt>
                  <dd>
                    {isQuoteLoading
                      ? t("checkout.recalculating")
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
                className="inline-flex items-center justify-center gap-2 rounded-pill bg-ink px-6 py-3.5 text-sm font-medium tracking-tight text-white transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:bg-ink/40"
              >
                {isSubmitting ? t("checkout.placingOrder") : isQuoteLoading ? t("checkout.calculating") : t("checkout.placeOrder")}
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
  "w-full rounded-pill border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const textareaClass =
  "w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent resize-y";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
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
  const { t } = useI18n();
  const formatPrice = useFormatPrice();
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
      <div className="rounded-2xl bg-accent/5 p-3 text-sm text-accent">
        {t("checkout.instapayMissing")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-3 shadow-soft">
      <p className="text-sm font-semibold text-ink">{t("checkout.transferInstructions")}</p>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>
          {t("checkout.sendTo")} <strong>{recipient.name}</strong> (<bdi dir="ltr">{recipient.identifier}</bdi>)
        </span>
        <button
          type="button"
          onClick={() => copy(recipient.identifier, "recipient")}
          className="text-xs font-semibold text-accent underline underline-offset-4"
        >
          {copied === "recipient" ? t("common.copied") : t("checkout.copy")}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span>
          {t("checkout.amount")} <strong>{formatPrice(amount, currency)}</strong>
        </span>
        <button
          type="button"
          onClick={() => copy((amount / 100).toFixed(2), "amount")}
          className="text-xs font-semibold text-accent underline underline-offset-4"
        >
          {copied === "amount" ? t("common.copied") : t("checkout.copy")}
        </button>
      </div>

      <p className="mt-3 rounded-pill bg-accent/5 px-3 py-2 text-xs text-ink">
        {t("checkout.whatsappBefore")}{" "}
        <a
          href={`https://wa.me/2${recipient.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent underline underline-offset-4"
        >
          <bdi dir="ltr">{recipient.whatsappNumber}</bdi>
        </a>{" "}
        {t("checkout.whatsappAfter")}
      </p>

      <label htmlFor={`${formId}-receipt`} className="mt-3 block text-sm font-semibold text-ink">
        {t("checkout.uploadReceipt")}
      </label>
      <input
        id={`${formId}-receipt`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="mt-2 block w-full text-sm"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {t("checkout.receiptHint")}
      </p>
      {receiptStatus === "uploading" && (
        <p className="mt-1 text-xs text-muted-foreground">{t("checkout.uploading")}</p>
      )}
      {receiptStatus === "uploaded" && (
        <p className="mt-1 text-xs text-green-700">
          {t("checkout.receiptUploaded")}
        </p>
      )}
      {receiptStatus === "error" && (
        <p className="mt-1 text-xs text-accent">{t("checkout.uploadFailed")}</p>
      )}
    </div>
  );
}
