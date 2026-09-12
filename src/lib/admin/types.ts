/**
 * Types verified directly against the live backend's admin API
 * (authenticated with the seeded OWNER_ADMIN account) — see
 * docs/FRONTEND_PROGRESS.md for the exact requests inspected. These are
 * closer to the raw Prisma rows than the public storefront types (no
 * locale mapping), which matches what the admin endpoints actually
 * return.
 */

export type StaffRole = "OWNER_ADMIN" | "CATALOG_MANAGER" | "ORDER_OPERATOR";

export interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  staff: Staff;
}

export type FulfillmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type ReceiptStatus = "PENDING_REVIEW" | "ACCEPTED" | "REJECTED";

export interface AdminOrderItem {
  id: string;
  orderId: string;
  variantId: string;
  productNameEn: string;
  productNameAr: string;
  variantSku: string;
  phoneModelNameEn: string | null;
  phoneModelNameAr: string | null;
  caseTypeNameEn: string | null;
  caseTypeNameAr: string | null;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  lineDiscount: number;
  bundleDiscount: number;
  lineTotal: number;
  createdAt: string;
  returns: { id: string; quantity: number; reason: string }[];
}

export interface AdminReceipt {
  id: string;
  status: ReceiptStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminRefund {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  sequenceNumber: number;
  trackingToken: string;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "CASH_ON_DELIVERY" | "INSTAPAY_MANUAL";
  latePaymentFlaggedAt: string | null;
  latePaymentNote: string | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  bundleDiscountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  shippingRateNameEn: string;
  shippingRateNameAr: string;
  customerFullName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingCountry: string;
  shippingCity: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingPostalCode: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
  receipts: AdminReceipt[];
  refunds: AdminRefund[];
}

export interface AdminOrdersResult {
  items: AdminOrder[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface AdminVariant {
  id: string;
  productId: string;
  sku: string;
  phoneModelId: string | null;
  caseTypeId: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  isActive: boolean;
  isUnlimitedStock: boolean;
  stockItemId: string | null;
}

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface MediaAsset {
  id: string;
  storageKey: string;
  url: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  altTextEn: string | null;
  altTextAr: string | null;
  createdAt: string;
}

export interface ProductMediaAttachment {
  id: string;
  productId: string;
  mediaAssetId: string;
  displayOrder: number;
  isPrimary: boolean;
  mediaAsset: MediaAsset;
}

export interface AdminProduct {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  status: ProductStatus;
  basePrice: number | null;
  currency: string;
  internalNotes: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: AdminVariant[];
  media: ProductMediaAttachment[];
}

export interface AdminProductsResult {
  items: AdminProduct[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export type CouponType = "FIXED" | "PERCENTAGE";

export interface AdminCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minSpend: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  basePrice?: number;
  internalNotes?: string;
}

export interface CreateVariantInput {
  sku: string;
  phoneModelId?: string;
  caseTypeId?: string;
  price: number;
  compareAtPrice?: number;
  isActive?: boolean;
  stockItemId?: string;
  isUnlimitedStock?: boolean;
}

export interface CreateCouponInput {
  code: string;
  type: CouponType;
  value: number;
  minSpend?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  isActive?: boolean;
}

export interface ShippingRate {
  id: string;
  zoneId: string;
  nameEn: string;
  nameAr: string;
  price: number;
  currency: string;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isActive: boolean;
  displayOrder: number;
}

export interface ShippingZone {
  id: string;
  nameEn: string;
  nameAr: string;
  countries: string[];
  isActive: boolean;
  displayOrder: number;
  rates: ShippingRate[];
}

export interface CreateShippingZoneInput {
  nameEn: string;
  nameAr: string;
  countries: string[];
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateShippingRateInput {
  nameEn: string;
  nameAr: string;
  price: number;
  freeShippingThreshold?: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  isActive?: boolean;
}

export interface BundleEligibleVariant {
  id: string;
  variantId: string;
  surchargeAmount: number;
}

export interface AdminBundle {
  id: string;
  name: string;
  fixedTotal: number;
  currency: string;
  requireDifferentPhoneModels: boolean;
  isRepeatable: boolean;
  allowCouponStacking: boolean;
  isEnabled: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  eligibleVariants: BundleEligibleVariant[];
}

export interface CreateBundleInput {
  name: string;
  fixedTotal: number;
  currency: string;
  requireDifferentPhoneModels?: boolean;
  isRepeatable?: boolean;
  allowCouponStacking?: boolean;
  isEnabled?: boolean;
  eligibleVariants: { variantId: string; surchargeAmount?: number }[];
}

export interface StaffMember {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffInput {
  email: string;
  fullName: string;
  password: string;
  role: StaffRole;
}

export interface UpdateStaffInput {
  fullName?: string;
  role?: StaffRole;
  isActive?: boolean;
}

export type PageStatus = "DRAFT" | "PUBLISHED";

export interface AdminPage {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  status: PageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageInput {
  slug: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}

/** Only "BANNER" (the default) has been confirmed live; other enum
 * values exist on the backend but weren't enumerated in the source. */
export type HomepageSectionType = string;

export interface AdminHomepageSection {
  id: string;
  type: HomepageSectionType;
  titleEn: string | null;
  titleAr: string | null;
  bodyEn: string | null;
  bodyAr: string | null;
  mediaAssetId: string | null;
  linkUrl: string | null;
  isEnabled: boolean;
  displayOrder: number;
}

export interface CreateHomepageSectionInput {
  type?: HomepageSectionType;
  titleEn?: string;
  titleAr?: string;
  bodyEn?: string;
  bodyAr?: string;
  linkUrl?: string;
  isEnabled?: boolean;
  displayOrder?: number;
}

export interface AdminRefundInput {
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface AdminItemReturnInput {
  quantity: number;
  reason: string;
}
