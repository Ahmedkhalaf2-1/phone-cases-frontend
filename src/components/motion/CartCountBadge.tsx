"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartProvider";

/**
 * The little count bubble on the bag icon. Pops when the count goes UP
 * while the page is open; never on first load/hydration (the baseline is
 * taken from the first non-loading render).
 */
export function CartCountBadge({ className }: { className: string }) {
  const { itemCount, isLoading } = useCart();
  const [state, setState] = useState<{ previous: number | null; bumps: number }>({
    previous: null,
    bumps: 0,
  });

  if (!isLoading && state.previous !== itemCount) {
    setState({
      previous: itemCount,
      bumps: state.previous !== null && itemCount > state.previous ? state.bumps + 1 : state.bumps,
    });
  }

  if (itemCount <= 0) return null;
  return (
    <span
      // Re-keying restarts the CSS animation for each increase.
      key={state.bumps}
      aria-hidden
      className={`${className} ${state.bumps > 0 ? "sf-pop" : ""}`}
    >
      {itemCount > 9 ? "9+" : itemCount}
    </span>
  );
}
