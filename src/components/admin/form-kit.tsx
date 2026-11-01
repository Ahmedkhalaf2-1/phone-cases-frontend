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
    <section className="rounded-card bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
          {step}
        </span>
        <div className="pt-0.5">
          <h2 className="font-semibold leading-tight text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-5">{children}</div>
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
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-background p-4 text-sm"
    >
      <span>
        <span className="font-semibold text-ink">{label}</span>
        <span id={`${id}-help`} className="mt-0.5 block text-muted-foreground">
          {help}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-help`}
        className="peer sr-only"
      />
      <SwitchTrack />
    </label>
  );
}

/** Visual track for a `peer sr-only` checkbox placed just before it. */
export function SwitchTrack({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative shrink-0 rounded-full bg-border transition-colors peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50 after:absolute after:top-0.5 after:start-0.5 after:rounded-full after:bg-white after:shadow after:transition-transform ${
        small
          ? "h-5 w-9 after:size-4 peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4"
          : "h-6 w-11 after:size-5 peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
      }`}
    />
  );
}

/** Compact on/off switch for list rows (enable / disable without opening the editor). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "WELCOME10 enabled". */
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center" title={checked ? "On — click to turn off" : "Off — click to turn on"}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <SwitchTrack small />
    </label>
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
      <div className="rounded-card bg-surface p-5 shadow-card">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <p className="mt-2 break-words font-display text-xl uppercase tracking-tight text-ink">
          {heading}
        </p>
        <dl className="mt-3 rounded-2xl bg-background px-4 py-1">{children}</dl>

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
 * Mobile/tablet primary action. Fixed to the viewport bottom (the admin
 * sidebar is a drawer below lg), padded for the home-indicator safe area.
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
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
