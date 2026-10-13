"use client";

import { useLinkStatus } from "next/link";

/**
 * Place inside a <Link>. Exposes the link's pending state to CSS
 * (`.sf-nav-target:has([data-link-pending="true"])`) so the clicked card
 * gives feedback immediately while a dynamic route is still loading.
 * Renders nothing visible and never blocks navigation.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden hidden data-link-pending={pending ? "true" : "false"} />;
}
