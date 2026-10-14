"use client";

import { useI18n } from "@/i18n/I18nProvider";

const COLORS: Record<string, string> = {
  // Fulfillment
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  // Payment
  UNPAID: "bg-surface text-muted-foreground",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-800",
  REFUNDED: "bg-surface text-muted-foreground",
  // Receipts
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  // Product status
  DRAFT: "bg-surface text-muted-foreground",
  PUBLISHED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-red-100 text-red-800",
  // Stock reservations
  ACTIVE: "bg-blue-100 text-blue-800",
  RELEASED: "bg-surface text-muted-foreground",
  EXPIRED: "bg-surface text-muted-foreground",
  CONSUMED: "bg-green-100 text-green-800",
};

export function StatusBadge({ status }: { status: string }) {
  const { tDynamic } = useI18n();
  // Enum values are never changed; only their display label is localized.
  const label = tDynamic(`orders.status.${status}`, status.replace(/_/g, " "));
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
        COLORS[status] ?? "bg-surface text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}
