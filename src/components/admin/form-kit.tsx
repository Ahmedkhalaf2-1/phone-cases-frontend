"use client";

import { useId } from "react";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "./admin-styles";

/** Numbered card used to group related fields in an admin editor. */
export function FormSection({
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

/** Checkbox with a bold label and an explanatory line, wired for screen readers. */
export function ToggleField({
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

export function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Inline field error, linked to its control via `id` for aria-describedby. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-accent">
      {message}
    </p>
  );
}

/**
 * Sticky live-summary card (desktop). Owns the primary action at lg and up;
 * below lg the page renders <MobileActionBar /> instead, so exactly one
 * primary action is ever visible.
 */
export function SummaryCard({
  eyebrow,
  heading,
  children,
  error,
  hint,
  submitLabel,
  isSaving,
  disabled,
  onCancel,
}: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
  error: string | null;
  /** First outstanding problem, shown while the action is disabled. */
  hint?: string;
  submitLabel: string;
  isSaving: boolean;
  disabled: boolean;
  onCancel: () => void;
}) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-3xl border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <p className="mt-2 break-words font-display text-xl uppercase tracking-tight text-ink">
          {heading}
        </p>
        <dl className="mt-3">{children}</dl>

        <div className="hidden lg:block">
          {error && (
            <p role="alert" className="mt-3 text-sm text-accent">
              {error}
            </p>
          )}
          {!error && hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSaving || disabled}
              className={primaryButtonClass}
            >
              {isSaving ? "Saving…" : submitLabel}
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
  );
}

/**
 * Mobile/tablet primary action. Fixed to the viewport bottom, offset past
 * the admin sidebar from sm up, padded for the home-indicator safe area.
 * The form must have matching bottom padding (pb-28) so it never hides
 * content.
 */
export function MobileActionBar({
  error,
  hint,
  idleText,
  submitLabel,
  isSaving,
  disabled,
}: {
  error: string | null;
  hint?: string;
  idleText: React.ReactNode;
  submitLabel: string;
  isSaving: boolean;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:start-56 lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="min-w-0 flex-1 text-xs">
          {error ? (
            <p role="alert" className="text-accent">
              {error}
            </p>
          ) : hint ? (
            <p className="text-muted-foreground">{hint}</p>
          ) : (
            idleText
          )}
        </div>
        <button
          type="submit"
          disabled={isSaving || disabled}
          className={`${primaryButtonClass} shrink-0`}
        >
          {isSaving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
