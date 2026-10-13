"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { apiErrorMessages } from "@/lib/admin/api-errors";
import { inputClass } from "@/components/admin/admin-styles";
import {
  FieldError,
  FormSection,
  MobileActionBar,
  SummaryCard,
  SummaryRow,
  ToggleField,
} from "@/components/admin/form-kit";
import {
  countryName,
  fieldForShippingMessage,
  parseCountries,
  SHIPPING_LIMITS,
  type ShippingField,
} from "@/lib/admin/shipping-display";
import type { CreateShippingZoneInput, ShippingZone } from "@/lib/admin/types";
import { CountryChips } from "./CountryChips";

type Errors = Partial<Record<ShippingField, string>>;

interface Values {
  nameEn: string;
  nameAr: string;
  countries: string;
  isActive: boolean;
  displayOrder: string;
}

function initialValues(zone: ShippingZone | null): Values {
  return {
    nameEn: zone?.nameEn ?? "",
    nameAr: zone?.nameAr ?? "",
    countries: zone?.countries.join(", ") ?? "",
    isActive: zone?.isActive ?? true,
    displayOrder: zone ? String(zone.displayOrder) : "",
  };
}

function validate(v: Values): Errors {
  const errors: Errors = {};
  if (!v.nameEn.trim()) errors.nameEn = "Enter the zone name in English.";
  if (!v.nameAr.trim()) errors.nameAr = "Enter the zone name in Arabic.";

  const codes = parseCountries(v.countries);
  const invalid = codes.filter((c) => !SHIPPING_LIMITS.countryPattern.test(c));
  if (codes.length === 0) errors.countries = "Add at least one country code, e.g. EG.";
  else if (invalid.length > 0) {
    errors.countries = `Use 2-letter country codes. Not valid: ${invalid.join(", ")}.`;
  }

  if (v.displayOrder.trim() !== "") {
    const n = Number(v.displayOrder);
    if (!Number.isInteger(n) || Math.abs(n) > SHIPPING_LIMITS.maxDisplayOrder) {
      errors.displayOrder = `Enter a whole number between -${SHIPPING_LIMITS.maxDisplayOrder.toLocaleString()} and ${SHIPPING_LIMITS.maxDisplayOrder.toLocaleString()}.`;
    }
  }
  return errors;
}

export function ShippingZoneEditor({ zone }: { zone: ShippingZone | null }) {
  const router = useRouter();
  const { authorizedFetch } = useAdminAuth();
  const isEditing = zone !== null;
  const ids = useId();

  const [initial] = useState(() => initialValues(zone));
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState<Partial<Record<ShippingField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const clientErrors = useMemo(() => validate(values), [values]);
  const hasProblems = Object.keys(clientErrors).length > 0;
  const firstProblem = Object.values(clientErrors)[0];
  const codes = parseCountries(values.countries);
  const validCodes = codes.filter((c) => SHIPPING_LIMITS.countryPattern.test(c));
  const unrecognised = validCodes.filter((c) => countryName(c) === null);

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
    const order = values.displayOrder.trim() === "" ? undefined : Number(values.displayOrder);

    let input: Partial<CreateShippingZoneInput>;
    if (isEditing) {
      input = {};
      if (nameEn !== initial.nameEn) input.nameEn = nameEn;
      if (nameAr !== initial.nameAr) input.nameAr = nameAr;
      if (validCodes.join(",") !== parseCountries(initial.countries).join(",")) {
        input.countries = validCodes;
      }
      if (values.isActive !== initial.isActive) input.isActive = values.isActive;
      if (values.displayOrder !== initial.displayOrder && order !== undefined) {
        input.displayOrder = order;
      }
      if (Object.keys(input).length === 0) {
        router.push("/admin/shipping");
        return;
      }
    } else {
      input = { nameEn, nameAr, countries: validCodes, isActive: values.isActive };
      if (order !== undefined) input.displayOrder = order;
    }

    setIsSaving(true);
    setFormError(null);
    setServerErrors({});
    try {
      await authorizedFetch((token) =>
        isEditing
          ? adminClient.updateShippingZone(token, zone.id, input)
          : adminClient.createShippingZone(token, input as CreateShippingZoneInput),
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
        setFormError("Could not save the zone. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const title = values.nameEn.trim() || "New zone";
  return (
    <form onSubmit={handleSave} noValidate className="mt-6 pb-28 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <FormSection
            step={1}
            title="Zone details"
            description="How this zone is named in the admin and at checkout."
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
                  placeholder="Egypt"
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
                  placeholder="مصر"
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
            title="Coverage"
            description="The countries this zone delivers to."
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-countries`} className="text-sm font-semibold text-ink">
                Countries
              </label>
              <input
                id={`${ids}-countries`}
                value={values.countries}
                onChange={(e) => set("countries", e.target.value, "countries")}
                onBlur={() => touch("countries")}
                placeholder="EG, SA, AE"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errorFor("countries"))}
                aria-describedby={`${ids}-countries-msg`}
                className={`${inputClass} w-full uppercase`}
              />
              <FieldError id={`${ids}-countries-msg`} message={errorFor("countries")} />
              {!errorFor("countries") && (
                <p className="text-xs text-muted-foreground">
                  2-letter ISO country codes, separated by commas or spaces.
                </p>
              )}
            </div>
            {validCodes.length > 0 && (
              <div className="mt-3">
                <CountryChips codes={validCodes} />
                {unrecognised.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Not a recognised country code: {unrecognised.join(", ")}. Double-check it.
                  </p>
                )}
              </div>
            )}
          </FormSection>

          <FormSection step={3} title="Status">
            <div className="flex flex-col gap-5">
              <ToggleField
                label="Active"
                help="While inactive, none of this zone's rates are offered at checkout."
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
                    Lower numbers are listed first. Leave empty for the default (0).
                  </p>
                )}
              </div>
            </div>
          </FormSection>
        </div>

        <SummaryCard
          eyebrow="Zone summary"
          heading={title}
          error={formError}
          hint={firstProblem}
          submitLabel={isEditing ? "Save changes" : "Create zone"}
          isSaving={isSaving}
          disabled={hasProblems}
          onCancel={() => router.push("/admin/shipping")}
        >
          <SummaryRow label="English" value={values.nameEn.trim() || "—"} />
          <SummaryRow
            label="Arabic"
            value={
              values.nameAr.trim() ? (
                <span dir="rtl" lang="ar">
                  {values.nameAr.trim()}
                </span>
              ) : (
                "—"
              )
            }
          />
          <SummaryRow
            label="Countries"
            value={validCodes.length > 0 ? validCodes.join(", ") : "—"}
          />
          <SummaryRow label="Status" value={values.isActive ? "Active" : "Inactive"} />
          {isEditing && (
            <SummaryRow
              label="Shipping rates"
              value={zone.rates.length}
            />
          )}
        </SummaryCard>
      </div>

      <MobileActionBar
        error={formError}
        hint={firstProblem}
        idleText={
          <p className="truncate font-semibold text-ink">
            {title}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {validCodes.length > 0 ? validCodes.join(", ") : "no countries"}
            </span>
          </p>
        }
        submitLabel={isEditing ? "Save changes" : "Create zone"}
        isSaving={isSaving}
        disabled={hasProblems}
      />
    </form>
  );
}
