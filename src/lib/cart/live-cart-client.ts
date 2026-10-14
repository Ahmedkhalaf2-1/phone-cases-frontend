import { ApiError, apiRequest, buildApiUrl } from "@/lib/api/http";
import type {
  CartView,
  CheckoutQuote,
  CreatedCart,
  CreateOrderInput,
  CustomDesign,
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
    input: { variantId: string; quantity: number; note?: string; customDesignId?: string },
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

  /**
   * Uploads a customer's image for a personalizable variant. Uses XHR
   * rather than fetch because fetch can't report upload progress.
   */
  uploadCustomDesign(
    token: string,
    input: { file: File; variantId: string },
    onProgress?: (fraction: number) => void,
  ): Promise<CustomDesign> {
    const url = buildApiUrl("/cart/custom-designs");
    const formData = new FormData();
    formData.append("file", input.file);
    formData.append("variantId", input.variantId);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("X-Cart-Token", token);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onerror = () =>
        reject(
          new ApiError(
            `Could not reach the API at ${url}. Is the backend running and reachable?`,
            undefined,
            undefined,
            undefined,
            "network",
          ),
        );
      xhr.onload = () => {
        let body: { message?: string | string[]; code?: string; details?: unknown } | null = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // Not JSON — handled below.
        }
        if (xhr.status >= 200 && xhr.status < 300 && body) {
          resolve(body as unknown as CustomDesign);
          return;
        }
        const message = Array.isArray(body?.message)
          ? body.message.join(" ")
          : body?.message ?? `Upload failed with status ${xhr.status}.`;
        reject(new ApiError(message, xhr.status, body?.code, body?.details, "http"));
      };
      xhr.send(formData);
    });
  },

  getCustomDesign(token: string, designId: string): Promise<CustomDesign> {
    return apiRequest<CustomDesign>(`/cart/custom-designs/${designId}`, {
      headers: { "X-Cart-Token": token },
    });
  },

  /** The mockup JPEG. Needs the cart header, so it can't be an <img src>. */
  async getCustomDesignPreview(token: string, designId: string): Promise<Blob> {
    const url = buildApiUrl(`/cart/custom-designs/${designId}/preview`);
    let response: Response;
    try {
      response = await fetch(url, { headers: { "X-Cart-Token": token } });
    } catch {
      throw new ApiError(`Could not reach the API at ${url}.`, undefined, undefined, undefined, "network");
    }
    if (!response.ok) {
      throw new ApiError(`Could not load the preview (status ${response.status}).`, response.status);
    }
    return response.blob();
  },

  getShippingOptions(country: string, locale?: string): Promise<ShippingOption[]> {
    const localeQuery = locale ? `&locale=${encodeURIComponent(locale)}` : "";
    return apiRequest<ShippingOption[]>(
      `/shipping-options?country=${encodeURIComponent(country)}${localeQuery}`,
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
