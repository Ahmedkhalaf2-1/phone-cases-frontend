"use client";

import { useState } from "react";

/**
 * Renders a value and gives it a brief settle animation when it CHANGES
 * (cart quantity / line price). Not on first render, so lists don't all
 * animate on arrival. The layout box is unchanged, so rows never jump.
 */
export function TickValue({ value, children }: { value: string | number; children: React.ReactNode }) {
  const [state, setState] = useState<{ value: string | number; ticks: number }>({
    value,
    ticks: 0,
  });
  if (state.value !== value) {
    setState({ value, ticks: state.ticks + 1 });
  }
  return (
    <span key={state.ticks} className={state.ticks > 0 ? "sf-tick" : undefined}>
      {children}
    </span>
  );
}
