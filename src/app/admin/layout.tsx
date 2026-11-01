"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { SITE } from "@/config/site";
import { LoadingRow } from "@/components/ui/Spinner";
import type { StaffRole } from "@/lib/admin/types";

type IconName = keyof typeof ICON_PATHS;

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles?: StaffRole[];
}

// Staff management and the audit log are owner-only in the backend
// itself — hiding them for other roles avoids a dead end, not a
// security control (the API enforces the real restriction).
const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders" },
      { href: "/admin/coupons", label: "Coupons", icon: "coupon" },
      { href: "/admin/bundles", label: "Bundles", icon: "bundle" },
      { href: "/admin/shipping", label: "Shipping", icon: "truck" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: "bag" },
      { href: "/admin/catalog/collections", label: "Collections", icon: "layers" },
      { href: "/admin/catalog/brands", label: "Brands", icon: "tag" },
      { href: "/admin/catalog/models", label: "Phone models", icon: "phone" },
      { href: "/admin/catalog/case-types", label: "Case types", icon: "shield" },
      { href: "/admin/stock", label: "Stock", icon: "box" },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/admin/homepage-sections", label: "Homepage", icon: "home" },
      { href: "/admin/pages", label: "Pages", icon: "file" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/admin/staff", label: "Staff", icon: "users", roles: ["OWNER_ADMIN"] },
      { href: "/admin/audit-log", label: "Audit log", icon: "history", roles: ["OWNER_ADMIN"] },
    ],
  },
];

const ROLE_LABEL: Record<StaffRole, string> = {
  OWNER_ADMIN: "Owner",
  CATALOG_MANAGER: "Catalog manager",
  ORDER_OPERATOR: "Order operator",
};

const ICON_PATHS = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  orders: "M9 3h6v4H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 12h6M9 16h4",
  coupon: "M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM19 5 5 19",
  bundle: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-1-3-3-5-5-4s0 4 5 4zm0 0c1-3 3-5 5-4s0 4-5 4z",
  truck: "M1 5h13v11H1zM14 9h4l3 3v4h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  bag: "M5 8h14l-1 13H6zM9 8V7a3 3 0 0 1 6 0v1",
  layers: "M12 2 22 7 12 12 2 7zM2 17l10 5 10-5M2 12l10 5 10-5",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  phone: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  box: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  home: "M3 11l9-8 9 8M5 9v12h14V9M10 21v-6h4v6",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  history: "M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7v5l3 2",
  external: "M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
} as const;

function Icon({ name, className = "size-[18px]" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { staff } = useAdminAuth();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group, index) => {
        const items = group.items.filter((item) => !item.roles || (staff && item.roles.includes(staff.role)));
        if (items.length === 0) return null;
        return (
          <div key={group.label ?? index}>
            {group.label && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${focusRing} ${
                        isActive ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-accent" />
                      )}
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function ProfileCard() {
  const { staff, logout, authorizedFetch, updateStaff } = useAdminAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  if (!staff) return null;
  // Renaming goes through the owner-only staff API.
  const canRename = staff.role === "OWNER_ADMIN";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!staff) return;
    const fullName = name.trim();
    if (fullName.length < 2 || fullName === staff.fullName) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await authorizedFetch((token) => adminClient.updateStaff(token, staff.id, { fullName }));
      updateStaff({ fullName });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your name.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white"
        >
          {initials(staff.fullName)}
        </span>
        {isEditing ? (
          <form onSubmit={save} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={inputId} className="sr-only">
              Your name
            </label>
            <input
              id={inputId}
              autoFocus
              value={name}
              minLength={2}
              disabled={isSaving}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setIsEditing(false)}
              className={`w-full rounded-lg bg-white/10 px-2 py-1 text-sm text-white ${focusRing}`}
            />
            <div className="flex gap-2 text-xs">
              <button type="submit" disabled={isSaving} className={`font-semibold text-white ${focusRing}`}>
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className={`text-white/60 ${focusRing}`}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white" title={staff.fullName}>
              {staff.fullName}
            </p>
            <p className="truncate text-xs text-white/55">{ROLE_LABEL[staff.role] ?? staff.role}</p>
          </div>
        )}
        {canRename && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setName(staff.fullName);
              setError(null);
              setIsEditing(true);
            }}
            aria-label="Edit your name"
            title="Edit your name"
            className={`rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            <Icon name="pencil" className="size-4" />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs font-medium">
        <Link
          href="/"
          target="_blank"
          className={`flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-white/75 hover:bg-white/10 hover:text-white ${focusRing}`}
        >
          <Icon name="external" className="size-3.5" />
          View shop
        </Link>
        <button
          type="button"
          onClick={logout}
          className={`flex items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-white/75 hover:bg-white/10 hover:text-white ${focusRing}`}
        >
          <Icon name="logout" className="size-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/admin" className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/contrast-logo-white.png" alt={SITE.brandName} width={908} height={120} className="h-4 w-auto" />
      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white/70 uppercase">
        Admin
      </span>
    </Link>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { staff, isLoading } = useAdminAuth();
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

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsMobileNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileNavOpen]);

  // The whole admin surface is staff-only and must never be indexed —
  // robots.txt disallows /admin too, but that alone doesn't guarantee a
  // crawler won't index a URL it reaches some other way.
  const noindex = <meta name="robots" content="noindex, nofollow" />;

  if (isLoginPage)
    return (
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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {noindex}

      {/* Mobile top bar */}
      <header className="flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-expanded={isMobileNavOpen}
          aria-controls={menuId}
          aria-label="Open menu"
          onClick={() => setIsMobileNavOpen(true)}
          className={`rounded-lg p-2 text-white hover:bg-white/10 ${focusRing}`}
        >
          <Icon name="menu" className="size-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMobileNavOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-ink p-4"
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsMobileNavOpen(false)}
                className={`rounded-lg p-2 text-white hover:bg-white/10 ${focusRing}`}
              >
                <Icon name="close" className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setIsMobileNavOpen(false)} />
            <div className="mt-auto">
              <ProfileCard />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-ink px-3 py-5 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <NavLinks />
        <div className="mt-auto">
          <ProfileCard />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
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
