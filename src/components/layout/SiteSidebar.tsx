"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";

/**
 * Persistent left icon rail — the primary desktop navigation, replacing
 * the old top text nav (see DESIGN.md's "Sidebar Nav Rail" reference).
 * Hidden on admin routes (which have their own nav in admin/layout.tsx)
 * and on mobile (the header's hamburger menu covers small screens).
 */
const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon, match: "home" as const },
  { href: "/phone-cases", label: "Phone cases", icon: GridIcon, match: "prefix" as const },
  { href: "/#collections", label: "Collections", icon: HeartIcon, match: "hash" as const },
  { href: "/track", label: "Track order", icon: TagIcon, match: "prefix" as const },
];

const ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-[16px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function SiteSidebar() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  // Hash isn't part of `pathname`, so "Collections" (an anchor on "/")
  // needs its own tracked state — otherwise it and "Home" would both
  // read as active on every homepage visit regardless of scroll spot.
  const [hash, setHash] = useState("");

  useEffect(() => {
    const readHash = () => setHash(window.location.hash);
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  if (pathname.startsWith("/admin")) return null;

  function isItemActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.match === "home") return pathname === "/" && hash !== "#collections";
    if (item.match === "hash") return pathname === "/" && hash === "#collections";
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[68px] flex-col items-center bg-background py-5 lg:flex">
      <Link
        href="/"
        aria-label="Home"
        className="flex size-11 items-center justify-center rounded-[16px] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden className="text-lg">
          ✳
        </span>
      </Link>

      <nav className="flex flex-1 flex-col items-center justify-center gap-3">
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`${ICON_BUTTON} ${
                isActive ? "bg-surface text-ink" : "text-ink/70 hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon />
            </Link>
          );
        })}
      </nav>

      <Link
        href="/cart"
        aria-label={`Shopping bag${itemCount > 0 ? `, ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`}
        className={`relative ${ICON_BUTTON} ${
          pathname === "/cart" ? "bg-surface text-ink" : "text-ink/70 hover:bg-surface hover:text-ink"
        }`}
      >
        <BagIcon />
        {itemCount > 0 && (
          <span
            aria-hidden
            className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-pill bg-accent text-[10px] font-medium text-white shadow-accent"
          >
            {itemCount > 9 ? "9+" : itemCount}
          </span>
        )}
      </Link>
    </aside>
  );
}

const ICON_SIZE = 20;
const STROKE = 1.75;

function HomeIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={STROKE} />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={STROKE} />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={STROKE} />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={STROKE} />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7.5-4.6-9.5-9.2C1.1 7.6 3 4.5 6.3 4.5c2 0 3.5 1.2 4.2 2.6.7-1.4 2.2-2.6 4.2-2.6 3.3 0 5.2 3.1 3.8 6.3C19.5 15.4 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12.5 12.5 20 4 11.5V4h7.5L20 12.5Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h12l1 13H5L6 8Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}
