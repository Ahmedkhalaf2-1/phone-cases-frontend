"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { SITE } from "@/config/site";
import { LoadingRow } from "@/components/ui/Spinner";
import type { StaffRole } from "@/lib/admin/types";

const NAV: { href: string; label: string; roles?: StaffRole[] }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/catalog/brands", label: "Brands" },
  { href: "/admin/catalog/models", label: "Phone models" },
  { href: "/admin/catalog/case-types", label: "Case types" },
  { href: "/admin/catalog/collections", label: "Collections" },
  { href: "/admin/bundles", label: "Bundles" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/shipping", label: "Shipping" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/homepage-sections", label: "Homepage" },
  // Staff management and the audit log are owner-only in the backend
  // itself — hiding them for other roles avoids a dead end, not a
  // security control (the API enforces the real restriction).
  { href: "/admin/staff", label: "Staff", roles: ["OWNER_ADMIN"] },
  { href: "/admin/audit-log", label: "Audit log", roles: ["OWNER_ADMIN"] },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { staff } = useAdminAuth();
  const visibleNav = NAV.filter((item) => !item.roles || (staff && item.roles.includes(staff.role)));
  return (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) => {
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-2xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isActive
                ? "bg-ink text-white"
                : "text-ink hover:bg-background"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { staff, isLoading, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!isLoading && !staff && !isLoginPage) {
      router.replace("/admin/login");
    }
  }, [isLoading, staff, isLoginPage, router]);

  // The whole admin surface is staff-only and must never be indexed —
  // robots.txt disallows /admin too, but that alone doesn't guarantee a
  // crawler won't index a URL it reaches some other way.
  const noindex = <meta name="robots" content="noindex, nofollow" />;

  if (isLoginPage) return (
    <>
      {noindex}
      {children}
    </>
  );

  if (isLoading || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {noindex}
        <LoadingRow label="Checking session…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {noindex}
      <header className="flex items-center justify-between border-b border-border bg-surface p-4 sm:hidden">
        <p className="font-display text-lg tracking-wide text-ink uppercase">
          {SITE.brandName} Admin
        </p>
        <button
          type="button"
          aria-expanded={isMobileNavOpen}
          aria-controls={menuId}
          aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsMobileNavOpen((open) => !open)}
          className="rounded-2xl p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            {isMobileNavOpen ? (
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
        </button>
      </header>

      {isMobileNavOpen && (
        <div
          id={menuId}
          className="flex flex-col gap-4 border-b border-border bg-surface p-4 sm:hidden"
        >
          <NavLinks onNavigate={() => setIsMobileNavOpen(false)} />
          <div className="border-t border-border pt-4 text-xs text-muted-foreground">
            <p className="font-semibold text-ink">{staff.fullName}</p>
            <p>{staff.role}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-2 text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <aside className="hidden w-56 shrink-0 flex-col border-e border-border bg-surface p-4 sm:flex">
        <p className="mb-6 font-display text-lg tracking-wide text-ink uppercase">
          {SITE.brandName} Admin
        </p>
        <NavLinks />
        <div className="mt-auto border-t border-border pt-4 text-xs text-muted-foreground">
          <p className="font-semibold text-ink">{staff.fullName}</p>
          <p>{staff.role}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 p-4 sm:p-8">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminGate>{children}</AdminGate>
    </AdminAuthProvider>
  );
}
