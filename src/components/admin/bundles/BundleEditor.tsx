"use client";

import { useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { AdminBundle, BundleScope, CreateBundleInput } from "@/lib/admin/types";
import {
  describeScope,
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  SCOPE_OPTIONS,
  secondaryButtonClass,
} from "./bundle-utils";
import {
  MAX_TARGETS,
  ProductPicker,
  TaxonomyPicker,
  type TargetSelection,
  VariantPicker,
  type VariantSelectionMap,
} from "./pickers";

const CURRENCY = "EGP";
// Mirror the backend limits (MAX_BUNDLE_SIZE / MAX_ELIGIBLE_VARIANTS).
const MAX_BUNDLE_SIZE = 50;
const MAX_SPECIFIC_VARIANTS = 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's local time. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (browser-local wall time) -> ISO timestamp for the API. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatLocal(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type TargetScope = Extract<
  BundleScope,
  "PRODUCTS" | "COLLECTIONS" | "CASE_TYPES" | "PHONE_BRANDS" | "PHONE_MODELS"
>;

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
          {step}
        </span>
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-help`}
        className="mt-1 size-4 accent-accent"
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span id={`${id}-help`} className="mt-0.5 block text-muted-foreground">
          {help}
        </span>
      </label>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function BundleEditor({
  bundle,
  onSaved,
  onCancel,
}: {
  bundle: AdminBundle | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const isEditing = bundle !== null;

  const [name, setName] = useState(bundle?.name ?? "");
  const [bundleSize, setBundleSize] = useState<string>(String(bundle?.bundleSize ?? 2));
  const [fixedTotal, setFixedTotal] = useState<number | null>(bundle?.fixedTotal ?? null);
  const [scope, setScope] = useState<BundleScope>(bundle?.scope ?? "ALL_PRODUCTS");
  const [targets, setTargets] = useState<TargetSelection>(() =>
    Object.fromEntries((bundle?.targets ?? []).map((t) => [t.id, t.nameEn])),
  );
  const [variants, setVariants] = useState<VariantSelectionMap>(() =>
    Object.fromEntries(
      (bundle?.eligibleVariants ?? []).map((v) => [
        v.variantId,
        {
          surcharge: v.surchargeAmount > 0 ? v.surchargeAmount : null,
          info: v.variant,
        },
      ]),
    ),
  );
  // "Any 2 for X" over mixed phones is the common offer, so new bundles
  // default to NOT requiring different models; the backend default (true)
  // still applies to API callers that omit the field.
  const [requireDifferentPhoneModels, setRequireDifferentPhoneModels] = useState(
    bundle?.requireDifferentPhoneModels ?? false,
  );
  const [isRepeatable, setIsRepeatable] = useState(bundle?.isRepeatable ?? true);
  const [allowCouponStacking, setAllowCouponStacking] = useState(
    bundle?.allowCouponStacking ?? false,
  );
  const [isEnabled, setIsEnabled] = useState(bundle?.isEnabled ?? false);
  // Schedule is held as datetime-local strings ("" = not set). The initial
  // values are remembered so only a field the admin actually changed is sent;
  // an untouched date is never re-written (and never loses its seconds).
  const [initialStartsAt] = useState(() => isoToLocalInput(bundle?.startsAt));
  const [initialExpiresAt] = useState(() => isoToLocalInput(bundle?.expiresAt));
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizeNumber = Number(bundleSize);
  const sizeValid =
    Number.isInteger(sizeNumber) && sizeNumber >= 2 && sizeNumber <= MAX_BUNDLE_SIZE;
  const totalValid = fixedTotal !== null && fixedTotal > 0;
  const isTargetScope = scope !== "ALL_PRODUCTS" && scope !== "SPECIFIC_VARIANTS";
  const targetCount = Object.keys(targets).length;
  const variantCount = Object.keys(variants).length;
  const scopeValid =
    scope === "ALL_PRODUCTS" ||
    (scope === "SPECIFIC_VARIANTS" ? variantCount >= 2 : targetCount >= 1);

  const problems: string[] = [];
  if (!name.trim()) problems.push("Give the bundle a name.");
  if (!sizeValid) problems.push(`Quantity must be a whole number from 2 to ${MAX_BUNDLE_SIZE}.`);
  if (!totalValid) problems.push("Enter a bundle price above 0.");
  if (!scopeValid) {
    problems.push(
      scope === "SPECIFIC_VARIANTS"
        ? "Select at least two variants."
        : "Select at least one item this offer applies to.",
    );
  }
  if (
    startsAt &&
    expiresAt &&
    new Date(expiresAt).getTime() <= new Date(startsAt).getTime()
  ) {
    problems.push("The end date must be after the start date.");
  }
  if (scope === "SPECIFIC_VARIANTS" && variantCount > MAX_SPECIFIC_VARIANTS) {
    problems.push(
      `Select at most ${MAX_SPECIFIC_VARIANTS} variants, or use a broader scope such as Collections or All products.`,
    );
  }
  if (isTargetScope && targetCount > MAX_TARGETS) {
    problems.push(`Select at most ${MAX_TARGETS} items.`);
  }

  function changeScope(next: BundleScope) {
    if (next === scope) return;
    setScope(next);
    // Selections belong to one scope; never carry ids across scopes.
    setTargets({});
    setVariants({});
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }
    const input: CreateBundleInput = {
      name: name.trim(),
      fixedTotal: fixedTotal as number,
      currency: bundle?.currency ?? CURRENCY,
      bundleSize: sizeNumber,
      scope,
      requireDifferentPhoneModels,
      isRepeatable,
      allowCouponStacking,
      isEnabled,
    };
    // Schedule: on edit, an emptied field is sent as null (explicit clear);
    // an unchanged field is omitted so the server keeps the stored value.
    if (startsAt !== initialStartsAt) input.startsAt = localInputToIso(startsAt);
    if (expiresAt !== initialExpiresAt) input.expiresAt = localInputToIso(expiresAt);

    if (scope === "SPECIFIC_VARIANTS") {
      input.eligibleVariants = Object.entries(variants).map(([variantId, v]) => ({
        variantId,
        surchargeAmount: v.surcharge ?? undefined,
      }));
    } else if (isTargetScope) {
      input.targetIds = Object.keys(targets);
    }

    setIsSaving(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        isEditing
          ? adminClient.updateBundle(token, bundle.id, input)
          : adminClient.createBundle(token, input),
      );
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the bundle.");
    } finally {
      setIsSaving(false);
    }
  }

  const scopeSummary = describeScope(
    scope,
    scope === "SPECIFIC_VARIANTS" ? variantCount : targetCount,
    Object.values(targets),
  );
  const dealReady = sizeValid && totalValid;

  return (
    <form onSubmit={handleSave} className="mt-6 pb-28 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section step={1} title="Offer details">
            <label htmlFor="bundle-name" className="text-sm font-semibold text-ink">
              Bundle name
            </label>
            <input
              id="bundle-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Any 2 Cases for 450"
              className={`${inputClass} mt-1.5 w-full`}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Internal label. Customers don&apos;t see this name.
            </p>
          </Section>

          <Section
            step={2}
            title="Deal"
            description="What the customer buys, and what they pay for it."
          >
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bundle-size" className="text-sm font-semibold text-ink">
                  Customer buys
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="bundle-size"
                    type="number"
                    min={2}
                    max={MAX_BUNDLE_SIZE}
                    step={1}
                    inputMode="numeric"
                    value={bundleSize}
                    onChange={(e) => setBundleSize(e.target.value)}
                    aria-invalid={!sizeValid}
                    className={`${inputClass} w-24`}
                  />
                  <span className="text-sm text-muted-foreground">eligible items</span>
                </div>
              </div>
              <span className="pb-2 text-sm font-semibold text-ink">for</span>
              <MoneyInput
                label="Bundle price"
                minorUnits={fixedTotal}
                onChange={setFixedTotal}
                className="w-40"
              />
            </div>
            <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm text-ink">
              {dealReady
                ? `Buy ${sizeNumber} for ${formatPrice(fixedTotal as number, CURRENCY)}.`
                : "Set a quantity (2 or more) and a price."}{" "}
              <span className="text-muted-foreground">
                The shop never charges more than the normal price: if the items
                cost less than the bundle price, the customer simply pays the
                normal price.
              </span>
            </p>
          </Section>

          <Section
            step={3}
            title="Applies to"
            description="Which products can be counted toward this offer."
          >
            <div
              role="radiogroup"
              aria-label="Applies to"
              className="grid gap-2 sm:grid-cols-2"
            >
              {SCOPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm transition-colors has-[:checked]:border-ink has-[:checked]:bg-surface hover:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent border-border`}
                >
                  <input
                    type="radio"
                    name="bundle-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => changeScope(option.value)}
                    className="mt-0.5 size-4 accent-accent"
                  />
                  <span>
                    <span className="block font-semibold text-ink">{option.label}</span>
                    <span className="block text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-5">
              {scope === "ALL_PRODUCTS" && (
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="font-semibold text-ink">All eligible products</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current and future products are included automatically — new
                    products qualify without editing this bundle.
                  </p>
                </div>
              )}
              {scope === "PRODUCTS" && (
                <ProductPicker selected={targets} onChange={setTargets} />
              )}
              {(scope === "COLLECTIONS" ||
                scope === "CASE_TYPES" ||
                scope === "PHONE_BRANDS" ||
                scope === "PHONE_MODELS") && (
                <TaxonomyPicker
                  key={scope}
                  scope={scope as Exclude<TargetScope, "PRODUCTS">}
                  selected={targets}
                  onChange={setTargets}
                />
              )}
              {scope === "SPECIFIC_VARIANTS" && (
                <VariantPicker selected={variants} onChange={setVariants} />
              )}
            </div>
          </Section>

          <Section
            step={4}
            title="Schedule"
            description="Optional. Leave both empty to run the offer immediately with no end date."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["Starts at", "bundle-starts-at", startsAt, setStartsAt],
                  ["Ends at", "bundle-expires-at", expiresAt, setExpiresAt],
                ] as const
              ).map(([label, id, value, setValue]) => (
                <div key={id} className="flex flex-col gap-1.5">
                  <label htmlFor={id} className="text-sm font-semibold text-ink">
                    {label}
                  </label>
                  <input
                    id={id}
                    type="datetime-local"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={`${inputClass} w-full`}
                  />
                  <button
                    type="button"
                    onClick={() => setValue("")}
                    disabled={!value}
                    className={`${linkButtonClass} self-start`}
                  >
                    Clear
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Times are in your browser&apos;s time zone (
              {Intl.DateTimeFormat().resolvedOptions().timeZone}). Whether the offer is
              live is always decided by the server.
            </p>
          </Section>

          <Section
            step={5}
            title="Advanced rules"
            description="Sensible defaults for most offers."
          >
            <div className="flex flex-col gap-4">
              <Toggle
                label="Repeatable per order"
                help={`If enabled, a customer with ${
                  sizeValid ? sizeNumber * 2 : 4
                } eligible items can receive the ${
                  sizeValid ? sizeNumber : 2
                }-item bundle twice.`}
                checked={isRepeatable}
                onChange={setIsRepeatable}
              />
              <Toggle
                label="Require different phone models"
                help="Only bundle items made for different phones, e.g. one case for an iPhone 15 and one for a Galaxy S24. Leave off for “any 2 cases”."
                checked={requireDifferentPhoneModels}
                onChange={setRequireDifferentPhoneModels}
              />
              <Toggle
                label="Allow stacking with coupons"
                help="Off: the bundle is skipped when the customer has a coupon applied. On: the bundle applies first, and the coupon discounts only what remains."
                checked={allowCouponStacking}
                onChange={setAllowCouponStacking}
              />
              <Toggle
                label="Active"
                help="Customers get the offer as soon as it is saved as active. Leave off to save it as a draft."
                checked={isEnabled}
                onChange={setIsEnabled}
              />
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-border bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Offer summary
            </p>
            <p className="mt-2 font-display text-xl uppercase tracking-tight text-ink">
              {name.trim() || "Untitled bundle"}
            </p>
            <dl className="mt-3">
              <SummaryRow
                label="Customer buys"
                value={sizeValid ? `${sizeNumber} items` : "—"}
              />
              <SummaryRow
                label="Customer pays"
                value={totalValid ? formatPrice(fixedTotal as number, CURRENCY) : "—"}
              />
              <SummaryRow label="Applies to" value={scopeSummary} />
              <SummaryRow label="Repeatable" value={isRepeatable ? "Yes" : "No"} />
              <SummaryRow
                label="Different phone models"
                value={requireDifferentPhoneModels ? "Required" : "Not required"}
              />
              <SummaryRow
                label="Coupons"
                value={allowCouponStacking ? "Combinable" : "Not combinable"}
              />
              <SummaryRow label="Starts" value={startsAt ? formatLocal(startsAt) : "Immediately"} />
              <SummaryRow label="Ends" value={expiresAt ? formatLocal(expiresAt) : "No end date"} />
              <SummaryRow label="Status" value={isEnabled ? "Active" : "Draft"} />
            </dl>

            {/* Desktop: actions live in the sticky summary. Below lg the
                sticky bottom bar below owns the primary action instead. */}
            <div className="hidden lg:block">
              {error && (
                <p role="alert" className="mt-3 text-sm text-accent">
                  {error}
                </p>
              )}
              {!error && problems.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">{problems[0]}</p>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSaving || problems.length > 0}
                  className={primaryButtonClass}
                >
                  {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create bundle"}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSaving}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile/tablet primary action. Fixed to the viewport bottom, offset
          past the admin sidebar from sm up, padded for the home-indicator
          safe area. The form has matching bottom padding so it never hides
          picker content. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:start-56 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            {error ? (
              <p role="alert" className="text-accent">
                {error}
              </p>
            ) : problems.length > 0 ? (
              <p className="text-muted-foreground">{problems[0]}</p>
            ) : (
              <p className="truncate font-semibold text-ink">
                {sizeNumber} for {formatPrice(fixedTotal as number, CURRENCY)}
                <span className="font-normal text-muted-foreground"> · {scopeSummary}</span>
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSaving || problems.length > 0}
            className={`${primaryButtonClass} shrink-0`}
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create bundle"}
          </button>
        </div>
      </div>
    </form>
  );
}
