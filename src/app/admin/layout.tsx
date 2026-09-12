"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { SITE } from "@/config/site";
import { LoadingRow } from "@/components/ui/Spinner";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/bundles", label: "Bundles" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/shipping", label: "Shipping" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/homepage-sections", label: "Homepage" },
  { href: "/admin/staff", label: "Staff" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-sm px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
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

  if (isLoginPage) return <>{children}</>;

  if (isLoading || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingRow label="Checking session…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
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
          className="rounded-sm p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
