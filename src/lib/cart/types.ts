/**
 * Types mirror the verified cart/checkout/shipping contract of
 * phone-cases-backend — see docs/FRONTEND_PROGRESS.md for the exact
 * source files inspected (cart.controller.ts, cart-pricing.service.ts,
 * checkout.controller.ts/.service.ts, orders-public.controller.ts,
 * order-response.mapper.ts, shipping-public.controller.ts,
 * receipts-cart.controller.ts, dto/create-order.dto.ts).
 */

export type CouponType = "FIXED" | "PERCENTAGE";

export interface CartCoupon {
  code: string;
  type: CouponType;
  value: number;
}

export interface CartItemPhoneModel {
  slug: string;
  name: string;
  brand: { slug: string; name: string };
}

export interface CartItemCaseType {
  slug: string;
  name: string;
}

export interface CartItemView {
  id: string;
  variantId: string;
  sku: string;
  productSlug: string;
  productName: string;
  phoneModel: CartItemPhoneModel | null;
  caseType: CartItemCaseType | null;
  thumbnail: { url: string; altText: string | null } | null;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  isAvailable: boolean;
  unavailableReason?: string;
  bundleDiscount: number;
}

export interface CartView {
  id: string;
  currency: string;
  items: CartItemView[];
  subtotal: number;
  discountTotal: number;
  bundleDiscountTotal: number;
  total: number;
  coupon: CartCoupon | null;
  couponWarning?: string;
}

export interface CreatedCart {
  token: string;
  cart: CartView;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export interface CheckoutQuoteIssue {
  itemId: string;
  reason: string;
}

export interface CheckoutQuote {
  items: CartItemView[];
  subtotal: number;
  discountTotal: number;
  bundleDiscountTotal: number;
  shippingTotal: number;
  total: number;
  currency: string;
  coupon: CartCoupon | null;
  couponWarning?: string;
  issues: CheckoutQuoteIssue[];
}

export type OrderPaymentMethod = "CASH_ON_DELIVERY" | "INSTAPAY_MANUAL";

export interface CreateOrderInput {
  idempotencyKey: string;
  customerFullName: string;
  customerEmail?: string;
  customerPhone: string;
  shippingCountry: string;
  shippingCity: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string;
  shippingPostalCode?: string;
  shippingRateId: string;
  expectedTotal: number;
  paymentMethod: OrderPaymentMethod;
  receiptId?: string;
}

export interface OrderReceiptView {
  id: string;
  status: "PENDING_REVIEW" | "ACCEPTED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
}

export interface GuestOrderItemView {
  sku: string;
  productName: string;
  phoneModelName: string | null;
  caseTypeName: string | null;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  lineDiscount: number;
  bundleDiscount: number;
  lineTotal: number;
}

export interface GuestOrderView {
  orderNumber: string;
  trackingToken: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentMethod: OrderPaymentMethod;
  receipts: OrderReceiptView[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  bundleDiscountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  shippingRateName: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    country: string;
    city: string;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string | null;
  };
  items: GuestOrderItemView[];
  createdAt: string;
}
