"use client";

import { CartCountBadge } from "@/components/motion/CartCountBadge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/CartProvider";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Persistent left icon rail — the primary desktop navigation, replacing
 * the old top text nav (see DESIGN.md's "Sidebar Nav Rail" reference).
 * Hidden on admin routes (which have their own nav in admin/layout.tsx)
 * and on mobile (the header's hamburger menu covers small screens).
 */
const NAV_ITEMS: {
  href: string;
  label: "nav.home" | "nav.collections" | "nav.designYourCase" | "nav.trackOrder";
  icon: () => React.JSX.Element;
  match: "home" | "prefix";
}[] = [
  { href: "/", label: "nav.home", icon: HomeIcon, match: "home" },
  { href: "/collections", label: "nav.collections", icon: GridIcon, match: "prefix" },
  { href: "/customize", label: "nav.designYourCase", icon: BrushIcon, match: "prefix" },
  { href: "/track", label: "nav.trackOrder", icon: TagIcon, match: "prefix" },
];

const ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-[16px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function SiteSidebar() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { t, tn } = useI18n();
  if (pathname.startsWith("/admin")) return null;

  function isItemActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.match === "home") return pathname === "/";
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="fixed inset-y-0 start-0 z-50 hidden w-[68px] flex-col items-center bg-background py-5 lg:flex">
      <Link
        href="/"
        aria-label={t("nav.home")}
        className="flex size-11 items-center justify-center rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ct-emblem.png"
          alt=""
          width={256}
          height={256}
          className="size-8"
        />
      </Link>

      <nav className="flex flex-1 flex-col items-center justify-center gap-3">
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={t(item.label)}
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
        aria-label={itemCount > 0 ? tn("nav.shoppingBagCount", itemCount) : t("nav.shoppingBag")}
        className={`relative ${ICON_BUTTON} ${
          pathname === "/cart" ? "bg-surface text-ink" : "text-ink/70 hover:bg-surface hover:text-ink"
        }`}
      >
        <BagIcon />
        <CartCountBadge className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-pill bg-accent text-[10px] font-medium text-white" />
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


function BrushIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M9.5 15.5l2-3 1.5 2 1-1.2 1.5 2.2" stroke="currentColor" strokeWidth={STROKE} strokeLinejoin="round" />
      <circle cx="10.5" cy="8.5" r="1.1" fill="currentColor" />
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
