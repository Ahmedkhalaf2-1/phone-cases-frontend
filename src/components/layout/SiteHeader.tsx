"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_NAV, SITE } from "@/config/site";
import { useCart } from "@/lib/cart/CartProvider";

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuId = useId();
  const searchId = useId();
  const router = useRouter();
  const { itemCount } = useCart();

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

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = searchQuery.trim();
    setIsSearchOpen(false);
    router.push(q ? `/phone-cases?q=${encodeURIComponent(q)}` : "/phone-cases");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span aria-hidden className="text-xl text-accent">
            ✳
          </span>
          <span className="font-display text-lg tracking-wide text-ink uppercase">
            {SITE.brandName}
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 md:flex"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-semibold tracking-wide text-ink uppercase transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            aria-expanded={isSearchOpen}
            aria-controls={searchId}
            aria-label={isSearchOpen ? "Close search" : "Search"}
            onClick={() => setIsSearchOpen((open) => !open)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <SearchIcon />
          </button>
          <span aria-hidden className="hidden h-5 w-px bg-border sm:inline-block" />
          <Link
            href="/cart"
            aria-label={`Shopping bag${itemCount > 0 ? `, ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`}
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BagIcon />
            {itemCount > 0 && (
              <span
                aria-hidden
                className="absolute end-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white"
              >
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm p-2 md:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <MenuIcon open={isMenuOpen} />
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div id={searchId} className="border-t border-border bg-surface px-4 py-3 sm:px-6 lg:px-8">
          <form
            role="search"
            onSubmit={submitSearch}
            className="mx-auto flex max-w-[1440px] gap-2"
          >
            <label htmlFor={`${searchId}-input`} className="sr-only">
              Search phone cases
            </label>
            <input
              id={`${searchId}-input`}
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone cases…"
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="submit"
              className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Search
            </button>
          </form>
        </div>
      )}

      <div
        id={menuId}
        // `inert` (not just zero-height/overflow-hidden) keeps the closed
        // menu's links out of both the tab order and the a11y tree —
        // collapsing height alone still leaves them keyboard-focusable.
        inert={!isMenuOpen}
        className={`grid overflow-hidden border-t border-border transition-[grid-template-rows] duration-300 ease-out md:hidden ${
          isMenuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0">
          <nav
            aria-label="Mobile"
            className="flex flex-col gap-1 px-4 py-4 sm:px-6"
          >
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="min-h-11 rounded-sm px-2 py-3 text-sm font-semibold tracking-wide text-ink uppercase hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {item.label}
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
