"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
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
import {
  browserTimeZone,
  formatDateTime,
  isoToLocalInput,
  localInputToIso,
} from "@/lib/admin/datetime";
import {
  COUPON_LIMITS,
  type CouponField,
  fieldForBackendMessage,
  formatDiscount,
  formatMinSpend,
} from "@/lib/admin/coupon-display";
import type { AdminCoupon, CouponType, CreateCouponInput } from "@/lib/admin/types";

type FieldErrors = Partial<Record<CouponField, string>>;

interface FormValues {
  code: string;
  type: CouponType;
  percentValue: string;
  fixedMinor: number | null;
  minSpend: number | null;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

function initialValues(coupon: AdminCoupon | null): FormValues {
  return {
    code: coupon?.code ?? "",
    type: coupon?.type ?? "PERCENTAGE",
    percentValue: coupon?.type === "PERCENTAGE" ? String(coupon.value) : "",
    fixedMinor: coupon?.type === "FIXED" ? coupon.value : null,
    minSpend: coupon?.minSpend ?? null,
    usageLimit: coupon?.usageLimit != null ? String(coupon.usageLimit) : "",
    startsAt: isoToLocalInput(coupon?.startsAt),
    expiresAt: isoToLocalInput(coupon?.expiresAt),
    // New coupons are live by default, matching the backend default.
    isActive: coupon?.isActive ?? true,
  };
}

function discountValue(v: FormValues): number | null {
  if (v.type === "FIXED") return v.fixedMinor;
  const n = Number(v.percentValue);
  return v.percentValue.trim() !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Client-side mirror of the backend rules (UX only - the server stays
 * authoritative and its messages are surfaced next to the same fields).
 */
function validate(v: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!v.code.trim()) errors.code = "Enter a coupon code.";
  else if (!COUPON_LIMITS.codePattern.test(v.code.trim())) {
    errors.code = "Use 3–32 letters, digits, hyphens or underscores.";
  }

  const value = discountValue(v);
  if (v.type === "PERCENTAGE") {
    if (value === null || !Number.isInteger(value) || value < 1 || value > 100) {
      errors.value = "Enter a whole percentage from 1 to 100.";
    }
  } else if (value === null || value <= 0) {
    errors.value = "Enter a discount amount above 0.";
  } else if (value > COUPON_LIMITS.maxMinorUnits) {
    errors.value = "That amount is too large.";
  }

  if (v.minSpend !== null && (v.minSpend < 0 || v.minSpend > COUPON_LIMITS.maxMinorUnits)) {
    errors.minSpend = "Enter a minimum spend of 0 or more.";
  }

  if (v.usageLimit.trim() !== "") {
    const n = Number(v.usageLimit);
    if (!Number.isInteger(n) || n < 1 || n > COUPON_LIMITS.maxUsageLimit) {
      errors.usageLimit = `Enter a whole number from 1 to ${COUPON_LIMITS.maxUsageLimit.toLocaleString()}.`;
    }
  }

  if (v.startsAt && v.expiresAt && new Date(v.expiresAt) <= new Date(v.startsAt)) {
    errors.expiresAt = "The expiry must be after the start.";
  }
  return errors;
}

/** Only fields that changed are sent on edit; `null` explicitly clears an optional one. */
function buildUpdate(initial: FormValues, next: FormValues): Partial<CreateCouponInput> {
  const input: Partial<CreateCouponInput> = {};
  const code = next.code.trim().toUpperCase();
  if (code !== initial.code) input.code = code;

  const valueChanged =
    next.type !== initial.type ||
    (next.type === "PERCENTAGE"
      ? next.percentValue !== initial.percentValue
      : next.fixedMinor !== initial.fixedMinor);
  if (valueChanged) {
    // The server validates type and value together, so send both.
    input.type = next.type;
    input.value = discountValue(next) as number;
  }

  if (next.minSpend !== initial.minSpend) input.minSpend = next.minSpend;
  if (next.usageLimit !== initial.usageLimit) {
    input.usageLimit = next.usageLimit.trim() === "" ? null : Number(next.usageLimit);
  }
  if (next.startsAt !== initial.startsAt) input.startsAt = localInputToIso(next.startsAt);
  if (next.expiresAt !== initial.expiresAt) input.expiresAt = localInputToIso(next.expiresAt);
  if (next.isActive !== initial.isActive) input.isActive = next.isActive;
  return input;
}

function buildCreate(v: FormValues): CreateCouponInput {
  const input: CreateCouponInput = {
    code: v.code.trim().toUpperCase(),
    type: v.type,
    value: discountValue(v) as number,
    isActive: v.isActive,
  };
  if (v.minSpend !== null) input.minSpend = v.minSpend;
  if (v.usageLimit.trim() !== "") input.usageLimit = Number(v.usageLimit);
  if (v.startsAt) input.startsAt = localInputToIso(v.startsAt);
  if (v.expiresAt) input.expiresAt = localInputToIso(v.expiresAt);
  return input;
}

export function CouponEditor({ coupon }: { coupon: AdminCoupon | null }) {
  const router = useRouter();
  const { authorizedFetch } = useAdminAuth();
  const isEditing = coupon !== null;
  const ids = useId();

  const [initial] = useState(() => initialValues(coupon));
  const [values, setValues] = useState<FormValues>(initial);
  const [moneyKey, setMoneyKey] = useState(0);
  const [touched, setTouched] = useState<Partial<Record<CouponField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const clientErrors = useMemo(() => validate(values), [values]);
  const hasProblems = Object.keys(clientErrors).length > 0;
  const firstProblem = Object.values(clientErrors)[0];

  function set<K extends keyof FormValues>(key: K, value: FormValues[K], field?: CouponField) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (field) setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  }
  const touch = (field: CouponField) => setTouched((prev) => ({ ...prev, [field]: true }));
  const errorFor = (field: CouponField): string | undefined =>
    serverErrors[field] ?? (touched[field] || submitted ? clientErrors[field] : undefined);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasProblems) {
      setFormError(firstProblem ?? null);
      return;
    }
    const input = isEditing ? buildUpdate(initial, values) : buildCreate(values);
    if (isEditing && Object.keys(input).length === 0) {
      router.push("/admin/coupons");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setServerErrors({});
    try {
      await authorizedFetch((token) =>
        isEditing
          ? adminClient.updateCoupon(token, coupon.id, input)
          : adminClient.createCoupon(token, input as CreateCouponInput),
      );
      router.push("/admin/coupons");
    } catch (err) {
      if (err instanceof ApiError) {
        const messages = Array.isArray(err.details)
          ? (err.details as unknown[]).filter((d): d is string => typeof d === "string")
          : [err.message];
        const mapped: FieldErrors = {};
        const unmapped: string[] = [];
        for (const message of messages.length > 0 ? messages : [err.message]) {
          const field = fieldForBackendMessage(message, err.code);
          if (field && !mapped[field]) mapped[field] = message;
          else if (!field) unmapped.push(message);
        }
        setServerErrors(mapped);
        setFormError(
          unmapped[0] ??
            (Object.keys(mapped).length > 0 ? "Please fix the highlighted fields." : err.message),
        );
      } else {
        setFormError("Could not save the coupon. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const code = values.code.trim().toUpperCase();
  const discount = discountValue(values);
  const discountText =
    discount !== null && !clientErrors.value ? formatDiscount(values.type, discount) : "—";
  const usageLimitNumber = values.usageLimit.trim() === "" ? null : Number(values.usageLimit);
  const alreadyUsed = coupon?.usageCount ?? 0;
  const limitBelowUsage =
    isEditing && usageLimitNumber !== null && !clientErrors.usageLimit && usageLimitNumber <= alreadyUsed;

  return (
    <form onSubmit={handleSave} noValidate className="mt-6 pb-28 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* ---- 1. details ---- */}
          <FormSection
            step={1}
            title="Coupon details"
            description="The code customers enter, and what it takes off."
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-code`} className="text-sm font-semibold text-ink">
                Coupon code
              </label>
              <input
                id={`${ids}-code`}
                value={values.code}
                onChange={(e) =>
                  set("code", e.target.value.toUpperCase().replace(/\s+/g, ""), "code")
                }
                onBlur={() => touch("code")}
                placeholder="WELCOME10"
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
                aria-invalid={Boolean(errorFor("code"))}
                aria-describedby={`${ids}-code-msg`}
                className={`${inputClass} w-full font-mono uppercase tracking-wide sm:max-w-sm`}
              />
              <FieldError id={`${ids}-code-msg`} message={errorFor("code")} />
              {!errorFor("code") && (
                <p className="text-xs text-muted-foreground">
                  3–32 characters: letters, digits, hyphens or underscores. Not case-sensitive.
                </p>
              )}
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">Discount type</legend>
              <div className="mt-1.5 grid gap-2 sm:max-w-md sm:grid-cols-2">
                {(
                  [
                    ["PERCENTAGE", "Percentage", "e.g. 10% off the cart"],
                    ["FIXED", "Fixed amount", "e.g. EGP 50 off the cart"],
                  ] as const
                ).map(([value, label, help]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3 text-sm transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
                  >
                    <input
                      type="radio"
                      name={`${ids}-type`}
                      value={value}
                      checked={values.type === value}
                      onChange={() => set("type", value, "value")}
                      className="mt-0.5 size-4 accent-accent"
                    />
                    <span>
                      <span className="block font-semibold text-ink">{label}</span>
                      <span className="block text-muted-foreground">{help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 sm:max-w-xs">
              {values.type === "PERCENTAGE" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-percent`} className="text-sm font-semibold text-ink">
                    Discount value (%)
                  </label>
                  <div className="relative">
                    <input
                      id={`${ids}-percent`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      step={1}
                      value={values.percentValue}
                      onChange={(e) => set("percentValue", e.target.value, "value")}
                      onBlur={() => touch("value")}
                      placeholder="10"
                      aria-invalid={Boolean(errorFor("value"))}
                      aria-describedby={`${ids}-value-msg`}
                      className={`${inputClass} w-full pe-10`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ) : (
                <div onBlur={() => touch("value")}>
                  <MoneyInput
                    key={`fixed-${moneyKey}`}
                    label="Discount value"
                    minorUnits={values.fixedMinor}
                    onChange={(minor) => set("fixedMinor", minor, "value")}
                  />
                </div>
              )}
              <FieldError id={`${ids}-value-msg`} message={errorFor("value")} />
            </div>
          </FormSection>

          {/* ---- 2. requirements ---- */}
          <FormSection
            step={2}
            title="Requirements"
            description="Optional limits on when the coupon can be used."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div onBlur={() => touch("minSpend")}>
                  <MoneyInput
                    key={`min-${moneyKey}`}
                    label="Minimum spend"
                    minorUnits={values.minSpend}
                    onChange={(minor) => set("minSpend", minor, "minSpend")}
                  />
                </div>
                <FieldError message={errorFor("minSpend")} />
                <div className="mt-1 flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">Leave empty for no minimum.</p>
                  {values.minSpend !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        set("minSpend", null, "minSpend");
                        setMoneyKey((k) => k + 1);
                      }}
                      className={`${linkButtonClass} !text-xs`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-limit`} className="text-sm font-semibold text-ink">
                  Usage limit
                </label>
                <input
                  id={`${ids}-limit`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={values.usageLimit}
                  onChange={(e) => set("usageLimit", e.target.value, "usageLimit")}
                  onBlur={() => touch("usageLimit")}
                  placeholder="Unlimited"
                  aria-invalid={Boolean(errorFor("usageLimit"))}
                  aria-describedby={`${ids}-limit-msg`}
                  className={`${inputClass} w-full`}
                />
                <FieldError id={`${ids}-limit-msg`} message={errorFor("usageLimit")} />
                {!errorFor("usageLimit") && (
                  <p className="text-xs text-muted-foreground">
                    Total times the coupon can be used. Leave empty for unlimited.
                    {isEditing && ` Used ${alreadyUsed} so far.`}
                  </p>
                )}
                {limitBelowUsage && (
                  <p className="text-xs text-accent">
                    It has already been used {alreadyUsed} time{alreadyUsed === 1 ? "" : "s"}, so
                    this limit means it is used up.
                  </p>
                )}
              </div>
            </div>
          </FormSection>

          {/* ---- 3. schedule ---- */}
          <FormSection
            step={3}
            title="Schedule"
            description="Optional. Leave both empty for a coupon that is valid immediately and never expires."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["startsAt", "Starts at"],
                  ["expiresAt", "Expires at"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-${field}`} className="text-sm font-semibold text-ink">
                    {label}
                  </label>
                  <input
                    id={`${ids}-${field}`}
                    type="datetime-local"
                    value={values[field]}
                    onChange={(e) => set(field, e.target.value, field)}
                    onBlur={() => touch(field)}
                    aria-invalid={Boolean(errorFor(field))}
                    aria-describedby={`${ids}-${field}-msg`}
                    className={`${inputClass} w-full`}
                  />
                  <FieldError id={`${ids}-${field}-msg`} message={errorFor(field)} />
                  <button
                    type="button"
                    onClick={() => set(field, "", field)}
                    disabled={!values[field]}
                    className={`${linkButtonClass} self-start`}
                  >
                    Clear
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Times are in your browser&apos;s time zone ({browserTimeZone()}). Whether a coupon
              is currently valid is always decided by the server.
            </p>
          </FormSection>

          {/* ---- 4. status ---- */}
          <FormSection step={4} title="Status">
            <ToggleField
              label="Enabled"
              help="Customers can use the coupon while it is enabled and inside its schedule. Turn off to pause it without deleting it."
              checked={values.isActive}
              onChange={(checked) => set("isActive", checked)}
            />
          </FormSection>
        </div>

        <SummaryCard
          eyebrow="Coupon summary"
          heading={code || "New coupon"}
          error={formError}
          hint={firstProblem}
          submitLabel={isEditing ? "Save changes" : "Create coupon"}
          isSaving={isSaving}
          disabled={hasProblems}
          onCancel={() => router.push("/admin/coupons")}
        >
          <SummaryRow label="Code" value={code || "—"} />
          <SummaryRow label="Discount" value={discountText} />
          <SummaryRow label="Minimum spend" value={formatMinSpend(values.minSpend)} />
          <SummaryRow
            label="Usage limit"
            value={
              usageLimitNumber !== null && !clientErrors.usageLimit
                ? `${usageLimitNumber.toLocaleString()} uses`
                : "Unlimited"
            }
          />
          {isEditing && <SummaryRow label="Used so far" value={alreadyUsed} />}
          <SummaryRow
            label="Starts"
            value={values.startsAt ? formatDateTime(values.startsAt) : "Immediately"}
          />
          <SummaryRow
            label="Expires"
            value={values.expiresAt ? formatDateTime(values.expiresAt) : "No expiry"}
          />
          <SummaryRow label="Status" value={values.isActive ? "Enabled" : "Disabled"} />
        </SummaryCard>
      </div>

      <MobileActionBar
        error={formError}
        hint={firstProblem}
        idleText={
          <p className="truncate font-semibold text-ink">
            {code || "New coupon"}
            <span className="font-normal text-muted-foreground"> · {discountText}</span>
          </p>
        }
        submitLabel={isEditing ? "Save changes" : "Create coupon"}
        isSaving={isSaving}
        disabled={hasProblems}
      />
    </form>
  );
}
