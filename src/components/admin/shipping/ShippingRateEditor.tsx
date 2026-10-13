"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { apiErrorMessages } from "@/lib/admin/api-errors";
import { inputClass, linkButtonClass } from "@/components/admin/admin-styles";
import {
  FieldError,
  FormSection,
  MobileActionBar,
  SummaryCard,
  SummaryRow,
  ToggleField,
} from "@/components/admin/form-kit";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { formatEgp } from "@/lib/admin/money";
import {
  fieldForShippingMessage,
  formatDeliveryEstimate,
  SHIPPING_LIMITS,
  type ShippingField,
} from "@/lib/admin/shipping-display";
import type { CreateShippingRateInput, ShippingRate, ShippingZone } from "@/lib/admin/types";

type Errors = Partial<Record<ShippingField, string>>;

interface Values {
  nameEn: string;
  nameAr: string;
  price: number | null;
  threshold: number | null;
  daysMin: string;
  daysMax: string;
  isActive: boolean;
  displayOrder: string;
}

function initialValues(rate: ShippingRate | null): Values {
  return {
    nameEn: rate?.nameEn ?? "",
    nameAr: rate?.nameAr ?? "",
    price: rate?.price ?? null,
    threshold: rate?.freeShippingThreshold ?? null,
    daysMin: rate?.estimatedDaysMin != null ? String(rate.estimatedDaysMin) : "",
    daysMax: rate?.estimatedDaysMax != null ? String(rate.estimatedDaysMax) : "",
    isActive: rate?.isActive ?? true,
    displayOrder: rate ? String(rate.displayOrder) : "",
  };
}

function parseDays(text: string): number | null | "invalid" {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= SHIPPING_LIMITS.maxDays ? n : "invalid";
}

function validate(v: Values): Errors {
  const errors: Errors = {};
  if (!v.nameEn.trim()) errors.nameEn = "Enter the rate name in English.";
  if (!v.nameAr.trim()) errors.nameAr = "Enter the rate name in Arabic.";

  if (v.price === null) errors.price = "Enter a price. Use 0 for free delivery.";
  else if (v.price < 0) errors.price = "The price cannot be negative.";
  else if (v.price > SHIPPING_LIMITS.maxMinorUnits) errors.price = "That price is too large.";

  if (v.threshold !== null) {
    if (v.threshold <= 0) {
      errors.freeShippingThreshold =
        "Enter an amount above 0, or clear the field for no free-shipping threshold.";
    } else if (v.threshold > SHIPPING_LIMITS.maxMinorUnits) {
      errors.freeShippingThreshold = "That amount is too large.";
    }
  }

  const min = parseDays(v.daysMin);
  const max = parseDays(v.daysMax);
  const dayHint = `Enter whole days from 0 to ${SHIPPING_LIMITS.maxDays}.`;
  if (min === "invalid") errors.estimatedDaysMin = dayHint;
  if (max === "invalid") errors.estimatedDaysMax = dayHint;
  if (typeof min === "number" && typeof max === "number" && max < min) {
    errors.estimatedDaysMax = "The maximum cannot be less than the minimum.";
  }

  if (v.displayOrder.trim() !== "") {
    const n = Number(v.displayOrder);
    if (!Number.isInteger(n) || Math.abs(n) > SHIPPING_LIMITS.maxDisplayOrder) {
      errors.displayOrder = `Enter a whole number between -${SHIPPING_LIMITS.maxDisplayOrder.toLocaleString()} and ${SHIPPING_LIMITS.maxDisplayOrder.toLocaleString()}.`;
    }
  }
  return errors;
}

export function ShippingRateEditor({
  zone,
  rate,
}: {
  zone: ShippingZone;
  rate: ShippingRate | null;
}) {
  const router = useRouter();
  const { authorizedFetch } = useAdminAuth();
  const isEditing = rate !== null;
  const ids = useId();

  const [initial] = useState(() => initialValues(rate));
  const [values, setValues] = useState<Values>(initial);
  const [moneyKey, setMoneyKey] = useState(0);
  const [touched, setTouched] = useState<Partial<Record<ShippingField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const clientErrors = useMemo(() => validate(values), [values]);
  const hasProblems = Object.keys(clientErrors).length > 0;
  const firstProblem = Object.values(clientErrors)[0];

  function set<K extends keyof Values>(key: K, value: Values[K], field?: ShippingField) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (field) setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  }
  const touch = (field: ShippingField) => setTouched((p) => ({ ...p, [field]: true }));
  const errorFor = (field: ShippingField): string | undefined =>
    serverErrors[field] ?? (touched[field] || submitted ? clientErrors[field] : undefined);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasProblems) {
      setFormError(firstProblem ?? null);
      return;
    }

    const nameEn = values.nameEn.trim();
    const nameAr = values.nameAr.trim();
    const min = parseDays(values.daysMin) as number | null;
    const max = parseDays(values.daysMax) as number | null;
    const order = values.displayOrder.trim() === "" ? undefined : Number(values.displayOrder);

    let input: Partial<CreateShippingRateInput>;
    if (isEditing) {
      // Only changed fields are sent; null explicitly clears an optional one.
      input = {};
      if (nameEn !== initial.nameEn) input.nameEn = nameEn;
      if (nameAr !== initial.nameAr) input.nameAr = nameAr;
      if (values.price !== initial.price) input.price = values.price as number;
      if (values.threshold !== initial.threshold) input.freeShippingThreshold = values.threshold;
      if (values.daysMin !== initial.daysMin) input.estimatedDaysMin = min;
      if (values.daysMax !== initial.daysMax) input.estimatedDaysMax = max;
      if (values.isActive !== initial.isActive) input.isActive = values.isActive;
      if (values.displayOrder !== initial.displayOrder && order !== undefined) {
        input.displayOrder = order;
      }
      if (Object.keys(input).length === 0) {
        router.push("/admin/shipping");
        return;
      }
    } else {
      input = {
        nameEn,
        nameAr,
        price: values.price as number,
        isActive: values.isActive,
      };
      if (values.threshold !== null) input.freeShippingThreshold = values.threshold;
      if (min !== null) input.estimatedDaysMin = min;
      if (max !== null) input.estimatedDaysMax = max;
      if (order !== undefined) input.displayOrder = order;
    }

    setIsSaving(true);
    setFormError(null);
    setServerErrors({});
    try {
      await authorizedFetch((token) =>
        isEditing
          ? adminClient.updateShippingRate(token, zone.id, rate.id, input)
          : adminClient.createShippingRate(token, zone.id, input as CreateShippingRateInput),
      );
      router.push("/admin/shipping");
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Errors = {};
        const unmapped: string[] = [];
        for (const message of apiErrorMessages(err)) {
          const field = fieldForShippingMessage(message);
          if (field && !mapped[field]) mapped[field] = message;
          else if (!field) unmapped.push(message);
        }
        setServerErrors(mapped);
        setFormError(
          unmapped[0] ??
            (Object.keys(mapped).length > 0 ? "Please fix the highlighted fields." : err.message),
        );
      } else {
        setFormError("Could not save the rate. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const title = values.nameEn.trim() || "New rate";
  const min = parseDays(values.daysMin);
  const max = parseDays(values.daysMax);
  const estimate =
    min === "invalid" || max === "invalid"
      ? null
      : formatDeliveryEstimate(min, max);
  const priceText =
    values.price === null || clientErrors.price
      ? "—"
      : values.price === 0
        ? "Free"
        : formatEgp(values.price);
  const thresholdText =
    values.threshold !== null && !clientErrors.freeShippingThreshold
      ? `From ${formatEgp(values.threshold)}`
      : "No threshold";

  return (
    <form onSubmit={handleSave} noValidate className="mt-6 pb-28 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <FormSection
            step={1}
            title="Rate details"
            description={`How this option is named to customers in ${zone.nameEn}.`}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-nameEn`} className="text-sm font-semibold text-ink">
                  Name (English)
                </label>
                <input
                  id={`${ids}-nameEn`}
                  value={values.nameEn}
                  onChange={(e) => set("nameEn", e.target.value, "nameEn")}
                  onBlur={() => touch("nameEn")}
                  placeholder="Standard delivery"
                  aria-invalid={Boolean(errorFor("nameEn"))}
                  aria-describedby={`${ids}-nameEn-msg`}
                  className={`${inputClass} w-full`}
                />
                <FieldError id={`${ids}-nameEn-msg`} message={errorFor("nameEn")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-nameAr`} className="text-sm font-semibold text-ink">
                  Name (Arabic)
                </label>
                <input
                  id={`${ids}-nameAr`}
                  dir="rtl"
                  lang="ar"
                  value={values.nameAr}
                  onChange={(e) => set("nameAr", e.target.value, "nameAr")}
                  onBlur={() => touch("nameAr")}
                  placeholder="توصيل عادي"
                  aria-invalid={Boolean(errorFor("nameAr"))}
                  aria-describedby={`${ids}-nameAr-msg`}
                  className={`${inputClass} w-full text-start`}
                />
                <FieldError id={`${ids}-nameAr-msg`} message={errorFor("nameAr")} />
              </div>
            </div>
          </FormSection>

          <FormSection
            step={2}
            title="Pricing"
            description="What delivery costs, and when it becomes free."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div onBlur={() => touch("price")}>
                  <MoneyInput
                    key={`price-${moneyKey}`}
                    label="Price"
                    minorUnits={values.price}
                    onChange={(minor) => set("price", minor, "price")}
                  />
                </div>
                <FieldError message={errorFor("price")} />
                {!errorFor("price") && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter 0 for free delivery.
                  </p>
                )}
              </div>
              <div>
                <div onBlur={() => touch("freeShippingThreshold")}>
                  <MoneyInput
                    key={`threshold-${moneyKey}`}
                    label="Free-shipping threshold"
                    minorUnits={values.threshold}
                    onChange={(minor) => set("threshold", minor, "freeShippingThreshold")}
                  />
                </div>
                <FieldError message={errorFor("freeShippingThreshold")} />
                <div className="mt-1 flex flex-wrap items-center gap-x-3">
                  <p className="text-xs text-muted-foreground">
                    Optional. Delivery is free once the order total (after discounts) reaches
                    this amount.
                  </p>
                  {values.threshold !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        set("threshold", null, "freeShippingThreshold");
                        setMoneyKey((k) => k + 1);
                      }}
                      className={`${linkButtonClass} !text-xs`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            step={3}
            title="Delivery estimate"
            description="Optional. Shown to customers as a range of days."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["daysMin", "estimatedDaysMin", "Minimum days", "2"],
                  ["daysMax", "estimatedDaysMax", "Maximum days", "5"],
                ] as const
              ).map(([key, field, label, placeholder]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-${key}`} className="text-sm font-semibold text-ink">
                    {label}
                  </label>
                  <input
                    id={`${ids}-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={SHIPPING_LIMITS.maxDays}
                    step={1}
                    value={values[key]}
                    onChange={(e) => set(key, e.target.value, field)}
                    onBlur={() => touch(field)}
                    placeholder={placeholder}
                    aria-invalid={Boolean(errorFor(field))}
                    aria-describedby={`${ids}-${key}-msg`}
                    className={`${inputClass} w-full`}
                  />
                  <FieldError id={`${ids}-${key}-msg`} message={errorFor(field)} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Leave both empty to show no estimate. A single value is shown as that many days.
            </p>
          </FormSection>

          <FormSection step={4} title="Status">
            <div className="flex flex-col gap-5">
              <ToggleField
                label="Enabled"
                help={
                  zone.isActive
                    ? "Customers can choose this rate at checkout while it is enabled."
                    : "Customers can choose this rate while it is enabled — but its zone is inactive, so it is not offered until the zone is active."
                }
                checked={values.isActive}
                onChange={(checked) => set("isActive", checked)}
              />
              <div className="flex flex-col gap-1.5 sm:max-w-xs">
                <label htmlFor={`${ids}-order`} className="text-sm font-semibold text-ink">
                  Display order
                </label>
                <input
                  id={`${ids}-order`}
                  type="number"
                  inputMode="numeric"
                  step={1}
                  value={values.displayOrder}
                  onChange={(e) => set("displayOrder", e.target.value, "displayOrder")}
                  onBlur={() => touch("displayOrder")}
                  placeholder="0"
                  aria-invalid={Boolean(errorFor("displayOrder"))}
                  aria-describedby={`${ids}-order-msg`}
                  className={`${inputClass} w-full`}
                />
                <FieldError id={`${ids}-order-msg`} message={errorFor("displayOrder")} />
                {!errorFor("displayOrder") && (
                  <p className="text-xs text-muted-foreground">
                    Lower numbers are listed first at checkout. Leave empty for the default (0).
                  </p>
                )}
              </div>
            </div>
          </FormSection>
        </div>

        <SummaryCard
          eyebrow="Rate summary"
          heading={title}
          error={formError}
          hint={firstProblem}
          submitLabel={isEditing ? "Save changes" : "Create rate"}
          isSaving={isSaving}
          disabled={hasProblems}
          onCancel={() => router.push("/admin/shipping")}
        >
          <SummaryRow label="Zone" value={zone.nameEn} />
          <SummaryRow label="Price" value={priceText} />
          <SummaryRow label="Free shipping" value={thresholdText} />
          <SummaryRow label="Delivery" value={estimate ?? "No estimate"} />
          <SummaryRow label="Status" value={values.isActive ? "Enabled" : "Disabled"} />
        </SummaryCard>
      </div>

      <MobileActionBar
        error={formError}
        hint={firstProblem}
        idleText={
          <p className="truncate font-semibold text-ink">
            {title}
            <span className="font-normal text-muted-foreground"> · {priceText}</span>
          </p>
        }
        submitLabel={isEditing ? "Save changes" : "Create rate"}
        isSaving={isSaving}
        disabled={hasProblems}
      />
    </form>
  );
}
