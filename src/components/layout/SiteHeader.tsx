"use client";

import { CartCountBadge } from "@/components/motion/CartCountBadge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { PRIMARY_NAV, SITE } from "@/config/site";
import { useCart } from "@/lib/cart/CartProvider";
import { HeaderSearch } from "@/components/search/HeaderSearch";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * The left sidebar (SiteSidebar, lg+ only) is the primary nav on desktop
 * now, mirroring the DESIGN.md reference's icon rail. This header keeps
 * only brand + inline search (and cart) at lg+, and falls back to its own text nav +
 * cart icon below lg where the sidebar is hidden.
 */

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const menuId = useId();
  const searchId = useId();
  const { itemCount } = useCart();
  const { t, tn } = useI18n();
  const pathname = usePathname();

  /**
   * Brand link: from any other page it just navigates home (normal Link
   * behavior). When already on the home page there is nowhere to go, so it
   * scrolls back to the top instead. Modified clicks (new tab/window) keep
   * their default behavior.
   */
  function handleBrandClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  useEffect(() => {
    if (!isMenuOpen && !isSearchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen, isSearchOpen]);

  return (
    <header className="sticky top-[var(--sf-announce-h,0px)] z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/"
            onClick={handleBrandClick}
            className="flex items-center gap-2 rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/contrast-logo.png"
              alt={SITE.brandName}
              width={908}
              height={120}
              className="h-5 w-auto shrink-0 sm:h-6"
            />
          </Link>

          {/* Inline search next to the brand (sm+). Mobile keeps the toggle. */}
          <div className="hidden w-full max-w-md sm:block">
            <HeaderSearch />
          </div>
        </div>

        <nav
          aria-label={t("nav.primary")}
          className="hidden items-center gap-8 md:flex lg:hidden"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="text-sm font-medium tracking-tight text-ink transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            aria-expanded={isSearchOpen}
            aria-controls={searchId}
            aria-label={isSearchOpen ? t("nav.closeSearch") : t("nav.openSearch")}
            onClick={() => setIsSearchOpen((open) => !open)}
            className="sm:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill p-2 transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <SearchIcon />
          </button>
          <LanguageSwitcher />
          <span aria-hidden className="hidden h-5 w-px bg-border sm:inline-block lg:hidden" />
          <Link
            href="/cart"
            aria-label={itemCount > 0 ? tn("nav.shoppingBagCount", itemCount) : t("nav.shoppingBag")}
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill p-2 transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
          >
            <BagIcon />
            <CartCountBadge className="absolute end-0.5 top-0.5 flex size-4 items-center justify-center rounded-pill bg-accent text-[10px] font-medium text-white" />
          </Link>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill p-2 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <MenuIcon open={isMenuOpen} />
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div id={searchId} className="sm:hidden border-t border-border bg-background px-4 py-3 sm:px-6 lg:px-8">
          <HeaderSearch
            variant="sheet"
            autoFocus
            onNavigate={() => setIsSearchOpen(false)}
          />
        </div>
      )}

      <div
        id={menuId}
        // `inert` (not just zero-height/overflow-hidden) keeps the closed
        // menu's links out of both the tab order and the a11y tree —
        // collapsing height alone still leaves them keyboard-focusable.
        inert={!isMenuOpen}
        className={`grid overflow-hidden border-t border-border transition-[grid-template-rows] duration-300 ease-out lg:hidden ${
          isMenuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0">
          <nav
            aria-label={t("nav.mobile")}
            className="flex flex-col gap-1 px-4 py-4 sm:px-6"
          >
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="min-h-11 rounded-pill px-3 py-3 text-sm font-medium tracking-tight text-ink hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M21 21l-4.3-4.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M6 8h12l1 13H5L6 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
