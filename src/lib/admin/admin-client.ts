import { apiRequest, ApiError, buildApiUrl } from "@/lib/api/http";
import type {
  AdminBundle,
  AdminCaseType,
  AdminCollection,
  AdminCoupon,
  AdminPhoneBrand,
  AdminPhoneModel,
  AuditLogResult,
  AdminHomepageSection,
  AdminItemReturnInput,
  AdminOrder,
  AdminOrdersResult,
  AdminPage,
  AdminProduct,
  AdminProductsResult,
  AdminRefundInput,
  AdminVariant,
  AuthSession,
  CreateBundleInput,
  CreateCaseTypeInput,
  CreateCollectionInput,
  CreateCouponInput,
  CreateHomepageSectionInput,
  CreatePageInput,
  CreatePhoneBrandInput,
  CreatePhoneModelInput,
  CreateProductInput,
  CreateShippingRateInput,
  CreateShippingZoneInput,
  CreateStaffInput,
  CreateVariantInput,
  StockItem,
  StockMovement,
  StockReservation,
  FulfillmentStatus,
  MediaAsset,
  PaymentStatus,
  ProductMediaAttachment,
  ProductStatus,
  ShippingRate,
  ShippingZone,
  StaffMember,
  UpdateStaffInput,
} from "@/lib/admin/types";

function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Admin panel client — always talks to the real backend (there is no
 * "demo admin"; staff auth and order/inventory changes are consequential
 * actions that must never be simulated). If the backend is unreachable,
 * calls throw `ApiError` and the UI must show that plainly, never a
 * fabricated success.
 */
export const adminClient = {
  login(email: string, password: string): Promise<AuthSession> {
    return apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      json: { email, password },
    });
  },

  refresh(refreshToken: string): Promise<AuthSession> {
    return apiRequest<AuthSession>("/auth/refresh", {
      method: "POST",
      json: { refreshToken },
    });
  },

  logout(refreshToken: string): Promise<void> {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      json: { refreshToken },
    });
  },

  listOrders(
    accessToken: string,
    params: {
      fulfillmentStatus?: FulfillmentStatus;
      paymentStatus?: PaymentStatus;
      page?: number;
      pageSize?: number;
    },
  ): Promise<AdminOrdersResult> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return apiRequest<AdminOrdersResult>(`/admin/orders?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getOrder(accessToken: string, id: string): Promise<AdminOrder> {
    return apiRequest<AdminOrder>(`/admin/orders/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  updateFulfillmentStatus(
    accessToken: string,
    id: string,
    status: FulfillmentStatus,
  ): Promise<AdminOrder> {
    return apiRequest<AdminOrder>(`/admin/orders/${id}/fulfillment-status`, {
      method: "PATCH",
      json: { status },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  updatePaymentStatus(
    accessToken: string,
    id: string,
    status: PaymentStatus,
  ): Promise<AdminOrder> {
    return apiRequest<AdminOrder>(`/admin/orders/${id}/payment-status`, {
      method: "PATCH",
      json: { status },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  rejectReceipt(
    accessToken: string,
    orderId: string,
    receiptId: string,
    reason: string,
  ): Promise<unknown> {
    return apiRequest(`/admin/orders/${orderId}/receipts/${receiptId}/reject`, {
      method: "PATCH",
      json: { reason },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  // Receipt bytes need an Authorization header, so a plain <img src> can't
  // load them — fetch as a Blob and let the caller manage an object URL.
  async getReceiptFile(accessToken: string, receiptId: string): Promise<Blob> {
    const url = buildApiUrl(`/admin/receipts/${receiptId}/file`);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new ApiError("Could not load the receipt image.", response.status);
    }
    return response.blob();
  },

  flagLatePayment(
    accessToken: string,
    orderId: string,
    note: string,
  ): Promise<AdminOrder> {
    return apiRequest<AdminOrder>(`/admin/orders/${orderId}/flag-late-payment`, {
      method: "PATCH",
      json: { note },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  listProducts(
    accessToken: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<AdminProductsResult> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return apiRequest<AdminProductsResult>(`/admin/products?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getProduct(accessToken: string, id: string): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(`/admin/products/${id}`, {
      headers: authHeader(accessToken),
    });
  },

  createProduct(
    accessToken: string,
    input: CreateProductInput,
  ): Promise<AdminProduct> {
    return apiRequest<AdminProduct>("/admin/products", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateProduct(
    accessToken: string,
    id: string,
    input: Partial<CreateProductInput>,
  ): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(`/admin/products/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateProductStatus(
    accessToken: string,
    id: string,
    status: ProductStatus,
  ): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(`/admin/products/${id}/status`, {
      method: "PATCH",
      json: { status },
      headers: authHeader(accessToken),
    });
  },

  createVariant(
    accessToken: string,
    productId: string,
    input: CreateVariantInput,
  ): Promise<AdminVariant> {
    return apiRequest<AdminVariant>(`/admin/products/${productId}/variants`, {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateVariant(
    accessToken: string,
    productId: string,
    variantId: string,
    input: Partial<CreateVariantInput>,
  ): Promise<AdminVariant> {
    return apiRequest<AdminVariant>(
      `/admin/products/${productId}/variants/${variantId}`,
      {
        method: "PATCH",
        json: input,
        headers: authHeader(accessToken),
      },
    );
  },

  uploadMedia(
    accessToken: string,
    file: File,
    altTextEn?: string,
  ): Promise<MediaAsset> {
    const formData = new FormData();
    formData.append("file", file);
    if (altTextEn) formData.append("altTextEn", altTextEn);
    return apiRequest<MediaAsset>("/admin/media/upload", {
      method: "POST",
      formData,
      headers: authHeader(accessToken),
    });
  },

  attachMediaToProduct(
    accessToken: string,
    productId: string,
    input: { mediaAssetId: string; displayOrder?: number; isPrimary?: boolean },
  ): Promise<ProductMediaAttachment> {
    return apiRequest<ProductMediaAttachment>(
      `/admin/media/products/${productId}`,
      { method: "POST", json: input, headers: authHeader(accessToken) },
    );
  },

  detachMediaFromProduct(
    accessToken: string,
    productId: string,
    mediaAssetId: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/admin/media/products/${productId}/${mediaAssetId}`,
      { method: "DELETE", headers: authHeader(accessToken) },
    );
  },

  listCoupons(accessToken: string): Promise<AdminCoupon[]> {
    return apiRequest<AdminCoupon[]>("/admin/coupons", {
      headers: authHeader(accessToken),
    });
  },

  createCoupon(
    accessToken: string,
    input: CreateCouponInput,
  ): Promise<AdminCoupon> {
    return apiRequest<AdminCoupon>("/admin/coupons", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateCoupon(
    accessToken: string,
    id: string,
    input: Partial<CreateCouponInput>,
  ): Promise<AdminCoupon> {
    return apiRequest<AdminCoupon>(`/admin/coupons/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  listStockItems(accessToken: string): Promise<StockItem[]> {
    return apiRequest<StockItem[]>("/admin/stock-items", {
      headers: authHeader(accessToken),
    });
  },

  createStockItem(
    accessToken: string,
    input: { sku: string; nameEn: string; nameAr?: string; onHand?: number },
  ): Promise<StockItem> {
    return apiRequest<StockItem>("/admin/stock-items", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  getStockItemMovements(
    accessToken: string,
    stockItemId: string,
  ): Promise<StockMovement[]> {
    return apiRequest<StockMovement[]>(
      `/admin/stock-items/${stockItemId}/movements`,
      { headers: authHeader(accessToken) },
    );
  },

  getStockItemReservations(
    accessToken: string,
    stockItemId: string,
  ): Promise<StockReservation[]> {
    return apiRequest<StockReservation[]>(
      `/admin/stock-items/${stockItemId}/reservations`,
      { headers: authHeader(accessToken) },
    );
  },

  adjustStock(
    accessToken: string,
    stockItemId: string,
    delta: number,
    reason: string,
  ): Promise<unknown> {
    return apiRequest(`/admin/stock-items/${stockItemId}/adjust`, {
      method: "PATCH",
      json: { delta, reason },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  // --- Refunds & returns ---
  createRefund(
    accessToken: string,
    orderId: string,
    input: AdminRefundInput,
  ): Promise<unknown> {
    return apiRequest(`/admin/orders/${orderId}/refunds`, {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  createItemReturn(
    accessToken: string,
    orderId: string,
    itemId: string,
    input: AdminItemReturnInput,
  ): Promise<unknown> {
    return apiRequest(`/admin/orders/${orderId}/items/${itemId}/returns`, {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Shipping zones & rates ---
  listShippingZones(accessToken: string): Promise<ShippingZone[]> {
    return apiRequest<ShippingZone[]>("/admin/shipping-zones", {
      headers: authHeader(accessToken),
    });
  },

  createShippingZone(
    accessToken: string,
    input: CreateShippingZoneInput,
  ): Promise<ShippingZone> {
    return apiRequest<ShippingZone>("/admin/shipping-zones", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  createShippingRate(
    accessToken: string,
    zoneId: string,
    input: CreateShippingRateInput,
  ): Promise<ShippingRate> {
    return apiRequest<ShippingRate>(`/admin/shipping-zones/${zoneId}/rates`, {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateShippingZone(
    accessToken: string,
    zoneId: string,
    input: Partial<CreateShippingZoneInput>,
  ): Promise<ShippingZone> {
    return apiRequest<ShippingZone>(`/admin/shipping-zones/${zoneId}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateShippingRate(
    accessToken: string,
    zoneId: string,
    rateId: string,
    input: Partial<CreateShippingRateInput>,
  ): Promise<ShippingRate> {
    return apiRequest<ShippingRate>(`/admin/shipping-zones/${zoneId}/rates/${rateId}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Bundles ---
  listBundles(accessToken: string): Promise<AdminBundle[]> {
    return apiRequest<AdminBundle[]>("/admin/bundles", {
      headers: authHeader(accessToken),
    });
  },

  createBundle(
    accessToken: string,
    input: CreateBundleInput,
  ): Promise<AdminBundle> {
    return apiRequest<AdminBundle>("/admin/bundles", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateBundle(
    accessToken: string,
    id: string,
    input: Partial<CreateBundleInput>,
  ): Promise<AdminBundle> {
    return apiRequest<AdminBundle>(`/admin/bundles/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  deleteBundle(accessToken: string, id: string): Promise<void> {
    return apiRequest<void>(`/admin/bundles/${id}`, {
      method: "DELETE",
      headers: authHeader(accessToken),
    });
  },

  // --- Staff ---
  listStaff(accessToken: string): Promise<StaffMember[]> {
    return apiRequest<StaffMember[]>("/admin/staff", {
      headers: authHeader(accessToken),
    });
  },

  createStaff(
    accessToken: string,
    input: CreateStaffInput,
  ): Promise<StaffMember> {
    return apiRequest<StaffMember>("/admin/staff", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateStaff(
    accessToken: string,
    id: string,
    input: UpdateStaffInput,
  ): Promise<StaffMember> {
    return apiRequest<StaffMember>(`/admin/staff/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Pages CMS ---
  listPages(accessToken: string): Promise<AdminPage[]> {
    return apiRequest<AdminPage[]>("/admin/pages", {
      headers: authHeader(accessToken),
    });
  },

  createPage(accessToken: string, input: CreatePageInput): Promise<AdminPage> {
    return apiRequest<AdminPage>("/admin/pages", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updatePage(
    accessToken: string,
    id: string,
    input: Partial<CreatePageInput>,
  ): Promise<AdminPage> {
    return apiRequest<AdminPage>(`/admin/pages/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updatePageStatus(
    accessToken: string,
    id: string,
    status: "DRAFT" | "PUBLISHED",
  ): Promise<AdminPage> {
    return apiRequest<AdminPage>(`/admin/pages/${id}/status`, {
      method: "PATCH",
      json: { status },
      headers: authHeader(accessToken),
    });
  },

  // --- Homepage sections CMS ---
  listHomepageSections(accessToken: string): Promise<AdminHomepageSection[]> {
    return apiRequest<AdminHomepageSection[]>("/admin/homepage-sections", {
      headers: authHeader(accessToken),
    });
  },

  createHomepageSection(
    accessToken: string,
    input: CreateHomepageSectionInput,
  ): Promise<AdminHomepageSection> {
    return apiRequest<AdminHomepageSection>("/admin/homepage-sections", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  updateHomepageSection(
    accessToken: string,
    id: string,
    input: Partial<CreateHomepageSectionInput>,
  ): Promise<AdminHomepageSection> {
    return apiRequest<AdminHomepageSection>(`/admin/homepage-sections/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  listAuditLog(
    accessToken: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<AuditLogResult> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return apiRequest<AuditLogResult>(`/admin/audit-logs?${query.toString()}`, {
      headers: authHeader(accessToken),
    });
  },

  // --- Phone brands ---
  listPhoneBrands(accessToken: string): Promise<AdminPhoneBrand[]> {
    return apiRequest<AdminPhoneBrand[]>("/admin/phone-brands", {
      headers: authHeader(accessToken),
    });
  },
  createPhoneBrand(
    accessToken: string,
    input: CreatePhoneBrandInput,
  ): Promise<AdminPhoneBrand> {
    return apiRequest<AdminPhoneBrand>("/admin/phone-brands", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },
  updatePhoneBrand(
    accessToken: string,
    id: string,
    input: Partial<CreatePhoneBrandInput>,
  ): Promise<AdminPhoneBrand> {
    return apiRequest<AdminPhoneBrand>(`/admin/phone-brands/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Phone models ---
  listPhoneModels(accessToken: string): Promise<AdminPhoneModel[]> {
    return apiRequest<AdminPhoneModel[]>("/admin/phone-models", {
      headers: authHeader(accessToken),
    });
  },
  createPhoneModel(
    accessToken: string,
    input: CreatePhoneModelInput,
  ): Promise<AdminPhoneModel> {
    return apiRequest<AdminPhoneModel>("/admin/phone-models", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },
  updatePhoneModel(
    accessToken: string,
    id: string,
    input: Partial<CreatePhoneModelInput>,
  ): Promise<AdminPhoneModel> {
    return apiRequest<AdminPhoneModel>(`/admin/phone-models/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Case types ---
  listCaseTypesAdmin(accessToken: string): Promise<AdminCaseType[]> {
    return apiRequest<AdminCaseType[]>("/admin/case-types", {
      headers: authHeader(accessToken),
    });
  },
  createCaseTypeAdmin(
    accessToken: string,
    input: CreateCaseTypeInput,
  ): Promise<AdminCaseType> {
    return apiRequest<AdminCaseType>("/admin/case-types", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },
  updateCaseTypeAdmin(
    accessToken: string,
    id: string,
    input: Partial<CreateCaseTypeInput>,
  ): Promise<AdminCaseType> {
    return apiRequest<AdminCaseType>(`/admin/case-types/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Collections (admin) ---
  listCollectionsAdmin(accessToken: string): Promise<AdminCollection[]> {
    return apiRequest<AdminCollection[]>("/admin/collections", {
      headers: authHeader(accessToken),
    });
  },
  createCollectionAdmin(
    accessToken: string,
    input: CreateCollectionInput,
  ): Promise<AdminCollection> {
    return apiRequest<AdminCollection>("/admin/collections", {
      method: "POST",
      json: input,
      headers: authHeader(accessToken),
    });
  },
  updateCollectionAdmin(
    accessToken: string,
    id: string,
    input: Partial<CreateCollectionInput>,
  ): Promise<AdminCollection> {
    return apiRequest<AdminCollection>(`/admin/collections/${id}`, {
      method: "PATCH",
      json: input,
      headers: authHeader(accessToken),
    });
  },

  // --- Product <-> collection association ---
  attachCollectionToProduct(
    accessToken: string,
    productId: string,
    collectionId: string,
  ): Promise<AdminProduct> {
    return apiRequest<AdminProduct>(`/admin/products/${productId}/collections`, {
      method: "POST",
      json: { collectionId },
      headers: authHeader(accessToken),
    });
  },
  detachCollectionFromProduct(
    accessToken: string,
    productId: string,
    collectionId: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/admin/products/${productId}/collections/${collectionId}`,
      { method: "DELETE", headers: authHeader(accessToken) },
    );
  },
};

export { ApiError };
