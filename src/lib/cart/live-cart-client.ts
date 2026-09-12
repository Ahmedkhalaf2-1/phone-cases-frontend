import { apiRequest } from "@/lib/api/http";
import type {
  CartView,
  CheckoutQuote,
  CreatedCart,
  CreateOrderInput,
  GuestOrderView,
  ShippingOption,
} from "@/lib/cart/types";

/**
 * Real backend cart/checkout client. Every call throws `ApiError` on
 * failure — nothing here ever substitutes fake success data.
 */
export const liveCartClient = {
  createCart(): Promise<CreatedCart> {
    return apiRequest<CreatedCart>("/cart", { method: "POST" });
  },

  getCart(token: string): Promise<CartView> {
    return apiRequest<CartView>("/cart", {
      headers: { "X-Cart-Token": token },
    });
  },

  addItem(
    token: string,
    input: { variantId: string; quantity: number },
  ): Promise<CartView> {
    return apiRequest<CartView>("/cart/items", {
      method: "POST",
      json: input,
      headers: { "X-Cart-Token": token },
    });
  },

  updateItemQuantity(
    token: string,
    itemId: string,
    quantity: number,
  ): Promise<CartView> {
    return apiRequest<CartView>(`/cart/items/${itemId}`, {
      method: "PATCH",
      json: { quantity },
      headers: { "X-Cart-Token": token },
    });
  },

  replaceVariant(
    token: string,
    itemId: string,
    newVariantId: string,
  ): Promise<CartView> {
    return apiRequest<CartView>(`/cart/items/${itemId}/variant`, {
      method: "PATCH",
      json: { newVariantId },
      headers: { "X-Cart-Token": token },
    });
  },

  removeItem(token: string, itemId: string): Promise<CartView> {
    return apiRequest<CartView>(`/cart/items/${itemId}`, {
      method: "DELETE",
      headers: { "X-Cart-Token": token },
    });
  },

  applyCoupon(token: string, code: string): Promise<CartView> {
    return apiRequest<CartView>("/cart/coupon", {
      method: "POST",
      json: { code },
      headers: { "X-Cart-Token": token },
    });
  },

  removeCoupon(token: string): Promise<CartView> {
    return apiRequest<CartView>("/cart/coupon", {
      method: "DELETE",
      headers: { "X-Cart-Token": token },
    });
  },

  getShippingOptions(country: string): Promise<ShippingOption[]> {
    return apiRequest<ShippingOption[]>(
      `/shipping-options?country=${encodeURIComponent(country)}`,
    );
  },

  checkoutQuote(
    token: string,
    input: { country: string; shippingRateId: string },
  ): Promise<CheckoutQuote> {
    return apiRequest<CheckoutQuote>("/checkout/quote", {
      method: "POST",
      json: input,
      headers: { "X-Cart-Token": token },
    });
  },

  uploadReceipt(token: string, file: File): Promise<{ receiptId: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<{ receiptId: string }>("/cart/receipts", {
      method: "POST",
      formData,
      headers: { "X-Cart-Token": token },
    });
  },

  replaceReceipt(token: string, file: File): Promise<{ receiptId: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<{ receiptId: string }>("/cart/receipts/replace", {
      method: "POST",
      formData,
      headers: { "X-Cart-Token": token },
    });
  },

  createOrder(
    token: string,
    input: CreateOrderInput,
  ): Promise<GuestOrderView> {
    return apiRequest<GuestOrderView>("/orders", {
      method: "POST",
      json: input,
      headers: { "X-Cart-Token": token },
    });
  },

  trackOrder(trackingToken: string): Promise<GuestOrderView> {
    return apiRequest<GuestOrderView>(
      `/orders/track/${encodeURIComponent(trackingToken)}`,
    );
  },
};
