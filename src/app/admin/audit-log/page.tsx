"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import type { AuditLogEntry, StaffMember } from "@/lib/admin/types";

const PAGE_SIZE = 30;
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const selectClass = `rounded-pill border border-border bg-background px-4 py-2 text-sm text-ink ${focusRing}`;

/** Areas that can be filtered on (backend entityType → label). */
const AREAS: { type: string; label: string }[] = [
  { type: "Order", label: "Orders" },
  { type: "OrderItem", label: "Returns" },
  { type: "Product", label: "Products" },
  { type: "ProductVariant", label: "Variants" },
  { type: "Collection", label: "Collections" },
  { type: "Coupon", label: "Coupons" },
  { type: "BundlePromotion", label: "Bundles" },
  { type: "ShippingZone", label: "Shipping zones" },
  { type: "ShippingRate", label: "Delivery options" },
  { type: "StockItem", label: "Stock" },
  { type: "PhoneBrand", label: "Brands" },
  { type: "PhoneModel", label: "Phone models" },
  { type: "CaseType", label: "Case types" },
  { type: "MediaAsset", label: "Images" },
  { type: "Page", label: "Pages" },
  { type: "HomepageSection", label: "Homepage" },
  { type: "StaffUser", label: "Staff" },
  { type: "CustomDesign", label: "Custom designs" },
];

/** What each kind of record is called in a sentence. */
const NOUN: Record<string, string> = {
  Order: "order",
  OrderItem: "order item",
  Product: "product",
  ProductVariant: "variant",
  Collection: "collection",
  Coupon: "coupon",
  BundlePromotion: "bundle",
  ShippingZone: "shipping zone",
  ShippingRate: "delivery option",
  StockItem: "stock item",
  PhoneBrand: "brand",
  PhoneModel: "phone model",
  CaseType: "case type",
  MediaAsset: "image",
  Page: "page",
  HomepageSection: "homepage section",
  StaffUser: "staff member",
  CustomDesign: "custom design",
};

const STATUS_WORD: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  published: "Active",
  draft: "Draft",
  archived: "Hidden",
};

type Tone = "create" | "update" | "delete" | "status" | "money" | "auth";

/** Turns an action code into a short sentence and a colour group. */
function describe(entry: AuditLogEntry): { verb: string; tone: Tone } {
  const a = entry.action;
  const noun = NOUN[entry.entityType] ?? entry.entityType;
  const status = (prefix: string) => STATUS_WORD[a.slice(prefix.length)] ?? a.slice(prefix.length).replace(/_/g, " ");

  if (a === "auth.login") return { verb: "signed in", tone: "auth" };
  if (a === "order.create") return { verb: "placed order", tone: "create" };
  if (a === "order.fulfillment.cancelled_expired") return { verb: "auto-cancelled unpaid order", tone: "delete" };
  if (a.startsWith("order.fulfillment.")) return { verb: `marked order as ${status("order.fulfillment.")}`, tone: "status" };
  if (a.startsWith("order.payment.")) return { verb: `set payment to ${status("order.payment.")} on order`, tone: "money" };
  if (a === "order.late_payment_flagged") return { verb: "flagged a late payment on order", tone: "money" };
  if (a === "order.refund.recorded") return { verb: "recorded a refund on order", tone: "money" };
  if (a === "order_item.return.recorded") return { verb: "recorded a return on", tone: "money" };
  if (a === "payment_receipt.reject") return { verb: "rejected a payment receipt on", tone: "money" };
  if (a === "payment_receipt.replace") return { verb: "replaced a payment receipt on", tone: "money" };
  if (a.startsWith("product.status.")) return { verb: `set product to ${status("product.status.")}`, tone: "status" };
  if (a.startsWith("page.status.")) return { verb: `set page to ${status("page.status.")}`, tone: "status" };
  if (a === "product.collection.attach") return { verb: "added to a collection", tone: "update" };
  if (a === "product.collection.detach") return { verb: "removed from a collection", tone: "update" };
  if (a === "product.media.attach" || a === "variant.media.attach") return { verb: `added a photo to ${noun}`, tone: "update" };
  if (a === "product.media.detach" || a === "variant.media.detach") return { verb: `removed a photo from ${noun}`, tone: "delete" };
  if (a === "product.media.reorder") return { verb: "reordered photos of product", tone: "update" };
  if (a === "product.media.update") return { verb: "changed the main photo of product", tone: "update" };
  if (a === "product_variant.print_spec.upsert") return { verb: "changed print settings of variant", tone: "update" };
  if (a === "product_variant.print_spec.delete") return { verb: "reset print settings of variant", tone: "delete" };
  if (a === "stock_item.adjust") return { verb: "adjusted stock of", tone: "update" };
  if (a === "media.upload") return { verb: "uploaded an image", tone: "create" };
  if (a === "media.delete") return { verb: "deleted an image", tone: "delete" };
  if (a === "custom_design.upload") return { verb: "uploaded a custom design", tone: "create" };
  if (a.endsWith(".create")) return { verb: `created ${noun}`, tone: "create" };
  if (a.endsWith(".delete")) return { verb: `deleted ${noun}`, tone: "delete" };
  if (a.endsWith(".update")) return { verb: `edited ${noun}`, tone: "update" };
  return { verb: a.replace(/[._]/g, " "), tone: "update" };
}

const TONE: Record<Tone, string> = {
  create: "bg-green-500",
  update: "bg-blue-500",
  delete: "bg-red-500",
  status: "bg-amber-500",
  money: "bg-accent",
  auth: "bg-muted-foreground/50",
};

/** Admin page for the record, when there is one. */
function entityHref(entry: AuditLogEntry): string | null {
  const id = entry.entityId;
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  switch (entry.entityType) {
    case "Order":
      return `/admin/orders/${id}`;
    case "OrderItem":
      return typeof meta.orderId === "string" ? `/admin/orders/${meta.orderId}` : null;
    case "Product":
      return `/admin/products/${id}`;
    case "ProductVariant":
      return typeof meta.productId === "string" ? `/admin/products/${meta.productId}#variants` : null;
    case "Collection":
      return `/admin/catalog/collections/${id}`;
    case "Coupon":
      return `/admin/coupons/${id}`;
    case "BundlePromotion":
      return "/admin/bundles";
    case "ShippingZone":
      return `/admin/shipping/zones/${id}`;
    case "ShippingRate":
      return typeof meta.zoneId === "string" ? `/admin/shipping/zones/${meta.zoneId}/rates/${id}` : "/admin/shipping";
    case "StockItem":
      return "/admin/stock";
    case "PhoneBrand":
      return "/admin/catalog/brands";
    case "PhoneModel":
      return "/admin/catalog/models";
    case "CaseType":
      return "/admin/catalog/case-types";
    case "Page":
      return "/admin/pages";
    case "HomepageSection":
      return "/admin/homepage-sections";
    case "StaffUser":
      return "/admin/staff";
    default:
      return null;
  }
}

/** A readable name for the record from its metadata, when one was logged. */
function entityName(entry: AuditLogEntry): string | null {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const changes = (meta.changes ?? {}) as Record<string, unknown>;
  for (const key of ["sequenceNumber", "code", "name", "nameEn", "slug", "sku", "email", "titleEn"]) {
    const value = meta[key] ?? changes[key];
    if (typeof value === "string" || typeof value === "number") {
      return key === "sequenceNumber" ? `#${value}` : String(value);
    }
  }
  return null;
}

const MONEY_KEY = /price|amount|total|minspend|basePrice|surcharge/i;

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && MONEY_KEY.test(key)) return `${(value / 100).toLocaleString("en-US")} EGP`;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Id$/, "")
    .replace(/^./, (c) => c.toUpperCase());
}

function dayLabel(date: Date) {
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default function AdminAuditLogPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [staffUserId, setStaffUserId] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listStaff(token))
      .then(setStaff)
      .catch(() => {});
  }, [accessToken, authorizedFetch]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    authorizedFetch((token) =>
      adminClient.listAuditLog(token, {
        page,
        pageSize: PAGE_SIZE,
        entityType: entityType || undefined,
        staffUserId: staffUserId || undefined,
      }),
    )
      .then((result) => {
        if (cancelled) return;
        setEntries(result.items);
        setMeta({ totalItems: result.meta.totalItems, totalPages: result.meta.totalPages });
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the audit log.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, authorizedFetch, page, entityType, staffUserId]);

  function change(fn: () => void) {
    setIsLoading(true);
    setOpenId(null);
    fn();
  }

  // Group the page's entries by day (entries arrive newest first).
  const groups: { label: string; items: AuditLogEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(new Date(entry.createdAt));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  const hasFilters = Boolean(entityType || staffUserId);

  return (
    <div className="max-w-4xl">
      <header>
        <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who changed what, newest first
          {meta ? ` · ${meta.totalItems.toLocaleString("en-US")} ${hasFilters ? "matching" : "recorded"} actions` : ""}
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          aria-label="Area"
          value={entityType}
          onChange={(e) =>
            change(() => {
              setEntityType(e.target.value);
              setPage(1);
            })
          }
          className={`${selectClass} ${entityType ? "border-ink font-semibold" : ""}`}
        >
          <option value="">Everything</option>
          {AREAS.map((area) => (
            <option key={area.type} value={area.type}>
              {area.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Staff member"
          value={staffUserId}
          onChange={(e) =>
            change(() => {
              setStaffUserId(e.target.value);
              setPage(1);
            })
          }
          className={`${selectClass} ${staffUserId ? "border-ink font-semibold" : ""}`}
        >
          <option value="">Anyone</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              change(() => {
                setEntityType("");
                setStaffUserId("");
                setPage(1);
              })
            }
            className="px-2 text-sm font-semibold text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading && entries.length === 0 ? (
        <div aria-hidden className="mt-5 flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : entries.length === 0 && !error ? (
        <div className="mt-5 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">Nothing recorded{hasFilters ? " for these filters" : " yet"}</p>
        </div>
      ) : (
        <div className={`mt-5 flex flex-col gap-5 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="sticky top-0 z-[1] bg-background/95 py-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur">
                {group.label}
              </h2>
              <ol className="mt-1 divide-y divide-border rounded-card bg-surface shadow-card">
                {group.items.map((entry) => {
                  const { verb, tone } = describe(entry);
                  const who = entry.staffUser?.fullName ?? (entry.action.startsWith("order.fulfillment.cancelled") ? "System" : "Customer");
                  const href = entityHref(entry);
                  const name = entityName(entry);
                  const isOpen = openId === entry.id;
                  const metaObj = (entry.metadata ?? {}) as Record<string, unknown>;
                  const details = (
                    metaObj.changes && typeof metaObj.changes === "object" ? metaObj.changes : metaObj
                  ) as Record<string, unknown>;
                  const detailKeys = Object.keys(details);
                  const time = new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <li key={entry.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-start gap-3">
                        <span className="relative mt-0.5 shrink-0">
                          <span
                            aria-hidden
                            className={`flex size-9 items-center justify-center rounded-full text-xs font-semibold ${
                              entry.staffUser ? "bg-ink text-white" : "bg-background text-muted-foreground"
                            }`}
                          >
                            {entry.staffUser ? initials(who) : who === "System" ? "⚙" : "👤"}
                          </span>
                          <span aria-hidden className={`absolute -end-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-surface ${TONE[tone]}`} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-ink">
                            <span className="font-semibold">{who}</span> {verb}{" "}
                            {entry.action !== "auth.login" &&
                              entry.action !== "media.upload" &&
                              entry.action !== "media.delete" &&
                              (href ? (
                                <Link href={href} className="font-semibold text-accent hover:underline">
                                  {name ?? "View →"}
                                </Link>
                              ) : (
                                name && <span className="font-semibold">{name}</span>
                              ))}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString("en-GB")}>
                              {time}
                            </time>
                            {entry.ipAddress && <span>· {entry.ipAddress}</span>}
                            {detailKeys.length > 0 && (
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() => setOpenId(isOpen ? null : entry.id)}
                                className="font-semibold text-ink hover:text-accent"
                              >
                                · {isOpen ? "Hide details" : "Details"}
                              </button>
                            )}
                          </p>
                          {isOpen && (
                            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-xl bg-background p-3 text-xs sm:grid-cols-[auto_1fr]">
                              {detailKeys.map((key) => (
                                <div key={key} className="contents">
                                  <dt className="text-muted-foreground">{humanKey(key)}</dt>
                                  <dd className="break-all text-ink">{formatValue(key, details[key])}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Page {page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => change(() => setPage((p) => p - 1))}
              className={`rounded-pill border border-border bg-background px-3.5 py-1.5 font-semibold text-ink enabled:hover:border-ink disabled:opacity-40 ${focusRing}`}
            >
              ← Newer
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages || isLoading}
              onClick={() => change(() => setPage((p) => p + 1))}
              className={`rounded-pill border border-border bg-background px-3.5 py-1.5 font-semibold text-ink enabled:hover:border-ink disabled:opacity-40 ${focusRing}`}
            >
              Older →
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(
          [
            ["create", "Created"],
            ["update", "Edited"],
            ["status", "Status change"],
            ["money", "Payment / refund"],
            ["delete", "Removed"],
          ] as const
        ).map(([tone, label]) => (
          <span key={tone} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-full ${TONE[tone]}`} />
            {label}
          </span>
        ))}
      </p>
    </div>
  );
}
