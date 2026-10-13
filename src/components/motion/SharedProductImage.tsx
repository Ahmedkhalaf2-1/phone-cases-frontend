"use client";

import { createContext, useContext, ViewTransition } from "react";

/**
 * View-transition names must be unique within a document. A rail that
 * renders its cards twice (for its seamless loop) provides `false` here
 * for the duplicate copy so only one card per product carries the name.
 */
const SharedElementContext = createContext(true);

export const SharedElementScope = SharedElementContext.Provider;

/**
 * Marks a product image as the shared element that morphs between the
 * product card and the product page. Wraps, never replaces, the image.
 *
 * Progressive enhancement: browsers without View Transitions (and users
 * with reduced motion - see globals.css) simply navigate normally.
 */
export function SharedProductImage({
  slug,
  enabled = true,
  children,
}: {
  slug: string;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const scopeEnabled = useContext(SharedElementContext);
  if (!enabled || !scopeEnabled) return <>{children}</>;
  return (
    <ViewTransition name={`product-${slug}`} share="sf-morph" default="none">
      {children}
    </ViewTransition>
  );
}
