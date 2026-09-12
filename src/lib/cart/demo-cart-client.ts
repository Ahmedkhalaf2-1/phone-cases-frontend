import { ApiError } from "@/lib/api/http";
import { DEMO_PRODUCTS } from "@/lib/demo/products.demo";
import type {
  CartItemView,
  CartView,
  CheckoutQuote,
  CreatedCart,
  CreateOrderInput,
  GuestOrderView,
  ShippingOption,
} from "@/lib/cart/types";

/**
 * DEMO CART — a local simulation, not a real backend integration.
 *
 * Used only while `NEXT_PUBLIC_DEMO_MODE=true` (i.e. no reachable
 * backend). State lives in `localStorage` on this device only. It exists
 * so the cart/checkout UI can be built and exercised end-to-end before a
 * live backend is reachable — every screen that uses it visibly labels
 * itself "Demo" and no demo order is ever presented as a real one.
 */

const STORAGE_KEY = "demo-cart-v1";
const ORDERS_KEY = "demo-orders-v1";
const DEMO_COUPON_CODE = "WELCOME10";
const DEMO_SHIPPING_RATES: Record<string, ShippingOption> = {
  "demo-standard": {
    id: "demo-standard",
    name: "Standard Shipping",
    price: 5000,
    currency: "EGP",
    freeShippingThreshold: 100000,
    estimatedDaysMin: 3,
    estimatedDaysMax: 5,
  },
  "demo-express": {
    id: "demo-express",
    name: "Express Shipping",
    price: 12000,
    currency: "EGP",
    freeShippingThreshold: null,
    estimatedDaysMin: 1,
    estimatedDaysMax: 2,
  },
};

interface DemoCartState {
  items: { id: string; variantId: string; quantity: number }[];
  couponCode: string | null;
}

function readState(): DemoCartState {
  if (typeof window === "undefined") return { items: [], couponCode: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoCartState) : { items: [], couponCode: null };
  } catch {
    return { items: [], couponCode: null };
  }
}

function writeState(state: DemoCartState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findVariant(variantId: string) {
  for (const product of DEMO_PRODUCTS) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

function buildCartView(state: DemoCartState): CartView {
  let currency = "EGP";
  const items: CartItemView[] = state.items.map((entry) => {
    const found = findVariant(entry.variantId);
    if (!found) {
      return {
        id: entry.id,
        variantId: entry.variantId,
        sku: "UNKNOWN",
        productSlug: "",
        productName: "Unknown item",
        phoneModel: null,
        caseType: null,
        thumbnail: null,
        unitPrice: 0,
        quantity: entry.quantity,
        lineSubtotal: 0,
        isAvailable: false,
        unavailableReason: "No longer sold",
        bundleDiscount: 0,
      };
    }
    const { product, variant } = found;
    currency = variant.currency;
    return {
      id: entry.id,
      variantId: variant.id,
      sku: variant.sku,
      productSlug: product.slug,
      productName: product.name,
      phoneModel: variant.phoneModel
        ? {
            slug: variant.phoneModel.slug,
            name: variant.phoneModel.name,
            brand: variant.phoneModel.brand,
          }
        : null,
      caseType: variant.caseType,
      thumbnail: product.primaryImage,
      unitPrice: variant.price,
      quantity: entry.quantity,
      lineSubtotal: variant.isAvailable ? variant.price * entry.quantity : 0,
      isAvailable: variant.isAvailable,
      unavailableReason: variant.isAvailable ? undefined : "Out of stock",
      bundleDiscount: 0,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);

  let discountTotal = 0;
  let couponWarning: string | undefined;
  let coupon: CartView["coupon"] = null;
  if (state.couponCode) {
    if (state.couponCode === DEMO_COUPON_CODE) {
      coupon = { code: DEMO_COUPON_CODE, type: "PERCENTAGE", value: 10 };
      discountTotal = Math.floor(subtotal * 0.1);
    } else {
      couponWarning = "This demo coupon code is no longer valid.";
    }
  }

  return {
    id: "demo-cart",
    currency,
    items,
    subtotal,
    discountTotal,
    bundleDiscountTotal: 0,
    total: Math.max(0, subtotal - discountTotal),
    coupon,
    couponWarning,
  };
}

function requireItem(state: DemoCartState, itemId: string) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) throw new ApiError("Cart item not found.", 404);
  return item;
}

export const demoCartClient = {
  async createCart(): Promise<CreatedCart> {
    const state: DemoCartState = { items: [], couponCode: null };
    writeState(state);
    return { token: "demo-cart-token", cart: buildCartView(state) };
  },

  async getCart(): Promise<CartView> {
    return buildCartView(readState());
  },

  async addItem(
    _token: string,
    input: { variantId: string; quantity: number },
  ): Promise<CartView> {
    const state = readState();
    const existing = state.items.find((i) => i.variantId === input.variantId);
    if (existing) {
      existing.quantity = Math.min(20, existing.quantity + input.quantity);
    } else {
      state.items.push({
        id: `demo-item-${crypto.randomUUID()}`,
        variantId: input.variantId,
        quantity: Math.min(20, input.quantity),
      });
    }
    writeState(state);
    return buildCartView(state);
  },

  async updateItemQuantity(
    _token: string,
    itemId: string,
    quantity: number,
  ): Promise<CartView> {
    const state = readState();
    requireItem(state, itemId).quantity = Math.max(1, Math.min(20, quantity));
    writeState(state);
    return buildCartView(state);
  },

  async removeItem(_token: string, itemId: string): Promise<CartView> {
    const state = readState();
    state.items = state.items.filter((i) => i.id !== itemId);
    writeState(state);
    return buildCartView(state);
  },

  async replaceVariant(
    _token: string,
    itemId: string,
    newVariantId: string,
  ): Promise<CartView> {
    const state = readState();
    const item = requireItem(state, itemId);
    if (!findVariant(newVariantId)) {
      throw new ApiError("Unknown demo variant.", 404);
    }
    item.variantId = newVariantId;
    writeState(state);
    return buildCartView(state);
  },

  async applyCoupon(_token: string, code: string): Promise<CartView> {
    const state = readState();
    if (code.trim().toUpperCase() !== DEMO_COUPON_CODE) {
      throw new ApiError(
        `Invalid demo coupon. Try "${DEMO_COUPON_CODE}" — this is a local simulation, not the real coupon system.`,
        400,
      );
    }
    state.couponCode = DEMO_COUPON_CODE;
    writeState(state);
    return buildCartView(state);
  },

  async removeCoupon(): Promise<CartView> {
    const state = readState();
    state.couponCode = null;
    writeState(state);
    return buildCartView(state);
  },

  async getShippingOptions(): Promise<ShippingOption[]> {
    return Object.values(DEMO_SHIPPING_RATES);
  },

  async checkoutQuote(
    _token: string,
    input: { country: string; shippingRateId: string },
  ): Promise<CheckoutQuote> {
    void input.country;
    const state = readState();
    const cart = buildCartView(state);
    const rate = DEMO_SHIPPING_RATES[input.shippingRateId];
    if (!rate) throw new ApiError("Unknown demo shipping rate.", 400);

    const eligibleForFreeShipping =
      rate.freeShippingThreshold !== null &&
      cart.total >= rate.freeShippingThreshold;
    const shippingTotal = eligibleForFreeShipping ? 0 : rate.price;

    return {
      items: cart.items,
      subtotal: cart.subtotal,
      discountTotal: cart.discountTotal,
      bundleDiscountTotal: 0,
      shippingTotal,
      total: cart.total + shippingTotal,
      currency: cart.currency,
      coupon: cart.coupon,
      couponWarning: cart.couponWarning,
      issues: cart.items
        .filter((item) => !item.isAvailable)
        .map((item) => ({
          itemId: item.id,
          reason: item.unavailableReason ?? "Unavailable",
        })),
    };
  },

  async uploadReceipt(_token: string, file: File): Promise<{ receiptId: string }> {
    return { receiptId: `demo-receipt-${file.name}-${Date.now()}` };
  },

  async replaceReceipt(_token: string, file: File): Promise<{ receiptId: string }> {
    return { receiptId: `demo-receipt-${file.name}-${Date.now()}` };
  },

  async createOrder(
    _token: string,
    input: CreateOrderInput,
  ): Promise<GuestOrderView> {
    const state = readState();
    const cart = buildCartView(state);
    const rate = DEMO_SHIPPING_RATES[input.shippingRateId];
    if (!rate) throw new ApiError("Unknown demo shipping rate.", 400);
    if (cart.items.some((item) => !item.isAvailable)) {
      throw new ApiError(
        "Some items in the demo cart are unavailable. Remove them before checking out.",
        409,
      );
    }

    const shippingTotal =
      rate.freeShippingThreshold !== null && cart.total >= rate.freeShippingThreshold
        ? 0
        : rate.price;
    const total = cart.total + shippingTotal;
    const trackingToken = `demo-${crypto.randomUUID()}`;

    const order: GuestOrderView = {
      orderNumber: `DEMO-${Math.floor(Math.random() * 9000 + 1000)}`,
      trackingToken,
      fulfillmentStatus: "PENDING",
      paymentStatus: "UNPAID",
      paymentMethod: input.paymentMethod,
      receipts: input.receiptId
        ? [
            {
              id: input.receiptId,
              status: "PENDING_REVIEW",
              rejectionReason: null,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      currency: cart.currency,
      subtotal: cart.subtotal,
      discountTotal: cart.discountTotal,
      bundleDiscountTotal: 0,
      shippingTotal,
      total,
      couponCode: cart.coupon?.code ?? null,
      shippingRateName: rate.name,
      shippingAddress: {
        fullName: input.customerFullName,
        phone: input.customerPhone,
        country: input.shippingCountry,
        city: input.shippingCity,
        addressLine1: input.shippingAddressLine1,
        addressLine2: input.shippingAddressLine2 ?? null,
        postalCode: input.shippingPostalCode ?? null,
      },
      items: cart.items.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        phoneModelName: item.phoneModel?.name ?? null,
        caseTypeName: item.caseType?.name ?? null,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineSubtotal: item.lineSubtotal,
        lineDiscount: 0,
        bundleDiscount: 0,
        lineTotal: item.lineSubtotal,
      })),
      createdAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      const orders = readOrders();
      orders[trackingToken] = order;
      window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      window.localStorage.removeItem(STORAGE_KEY);
    }

    return order;
  },

  async trackOrder(trackingToken: string): Promise<GuestOrderView> {
    const orders = readOrders();
    const order = orders[trackingToken];
    if (!order) throw new ApiError("Order not found.", 404);
    return order;
  },
};

function readOrders(): Record<string, GuestOrderView> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, GuestOrderView>) : {};
  } catch {
    return {};
  }
}
