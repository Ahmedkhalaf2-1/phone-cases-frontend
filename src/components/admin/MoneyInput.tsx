"use client";

import { useId, useState } from "react";

/**
 * Lets an operator type/read money in whole EGP (e.g. "450.00") while the
 * value handed to the rest of the app — and ultimately the API — stays
 * in integer minor units (piastres), matching every backend money field.
 * `Math.round` after the ×100 conversion avoids the classic
 * floating-point drift (e.g. `375.35 * 100` landing on `37534.999999…`).
 */
export function MoneyInput({
  minorUnits,
  onChange,
  label,
  className = "",
  required,
}: {
  minorUnits: number | null;
  onChange: (minorUnits: number | null) => void;
  label: string;
  className?: string;
  required?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(
    minorUnits !== null ? (minorUnits / 100).toFixed(2) : "",
  );

  function commit(value: string) {
    setText(value);
    if (value.trim() === "") {
      onChange(null);
      return;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      onChange(Math.round(parsed * 100));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label} (EGP)
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">
          EGP
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          required={required}
          value={text}
          onChange={(e) => commit(e.target.value)}
          className={`w-full rounded-pill border border-border bg-background py-2 ps-14 pe-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
        />
      </div>
    </div>
  );
}
