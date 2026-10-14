"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { usePathname } from "next/navigation";
import { apiGet } from "@/lib/api/http";
import { DEMO_MODE } from "@/lib/env";
import type { BundleOffer } from "@/lib/api/types";
import {
  offerBody,
  offerHeadline,
  offerSignature,
  pickPrimaryOffer,
} from "@/lib/bundles";

/** A dismissed offer stays away for this long (per offer, see offerSignature). */
const SUPPRESS_MS = 3 * 24 * 60 * 60 * 1000;
/** Let the page settle before offering anything. */
const SHOW_DELAY_MS = 1800;
const STORAGE_PREFIX = "contrast:bundle-promo:";

/** Pages where a promo helps; never over cart/checkout/order screens. */
function isBrowsingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/phone-cases")
  );
}

// Survives route changes within the page load even if storage is blocked.
const dismissedThisSession = new Set<string>();

function isSuppressed(signature: string): boolean {
  if (dismissedThisSession.has(signature)) return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + signature);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) && Date.now() - at < SUPPRESS_MS;
  } catch {
    return false;
  }
}

function rememberDismissal(signature: string) {
  dismissedThisSession.add(signature);
  try {
    window.localStorage.setItem(STORAGE_PREFIX + signature, String(Date.now()));
  } catch {
    // Storage blocked (private mode): the in-memory set still covers this visit.
  }
}

/**
 * First-visit promo for the active bundle offer. A compact, non-blocking
 * card - bottom sheet on phones, lower-right card from `sm` up - with a
 * plain close button. Mounted only in the storefront branch of AppShell.
 * All numbers come from the backend; the CTA is the normal browsing page.
 */
export function BundlePromoSheet() {
  const pathname = usePathname();
  const i18n = useI18n();
  const [offer, setOffer] = useState<BundleOffer | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const browsing = isBrowsingPath(pathname);

  // Fetch once per page load, after first paint; failures are silent.
  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    apiGet<BundleOffer[]>("/bundles/active")
      .then((offers) => {
        if (cancelled || !Array.isArray(offers)) return;
        setOffer(pickPrimaryOffer(offers));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const signature = offer ? offerSignature(offer) : null;

  useEffect(() => {
    if (!signature || !browsing) return;
    if (isSuppressed(signature)) return;
    const timer = setTimeout(() => setIsOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [signature, browsing]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // dismiss only closes over `signature`, which is in the deps below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, signature]);

  function dismiss() {
    if (signature) rememberDismissal(signature);
    setIsOpen(false);
  }

  // Leaving the browsing pages hides it without counting as a dismissal.
  if (!offer || !isOpen || !browsing) return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="bundle-promo-title"
      className="sf-sheet-in fixed inset-x-0 bottom-[var(--pdp-dock-h,0px)] z-50 rounded-t-3xl bg-ink px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-lifted sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[22rem] sm:rounded-3xl sm:pb-5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={i18n.t("bundles.popupClose")}
        className="absolute end-2 top-2 inline-flex size-11 items-center justify-center rounded-pill text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>

      <p className="text-[11px] font-semibold tracking-widest text-white/60 uppercase">
        {i18n.t("bundles.popupLabel")}
      </p>
      <h2
        id="bundle-promo-title"
        className="mt-1 pe-10 font-display text-3xl leading-tight tracking-tighter"
      >
        {offerHeadline(offer, i18n)}
      </h2>
      <p className="mt-2 text-sm leading-5 text-white/80">{offerBody(offer, i18n)}</p>

      <Link
        href="/phone-cases"
        onClick={dismiss}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-white px-6 text-sm font-semibold tracking-tight text-ink transition-colors hover:bg-accent-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {i18n.t("bundles.popupCta")}
      </Link>
    </aside>
  );
}
