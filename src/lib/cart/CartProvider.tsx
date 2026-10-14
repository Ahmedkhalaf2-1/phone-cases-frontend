"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiErrorMessage } from "@/i18n/api-errors";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/http";
import { cartClient, CART_SOURCE } from "@/lib/cart/cart-client";
import type { CartView } from "@/lib/cart/types";

// Namespaced by mode so a demo-mode token and a live-mode token can never
// collide in the same browser storage.
const TOKEN_STORAGE_KEY = `cart-token:${CART_SOURCE}`;

/** Status codes that mean "this token is gone/invalid" — safe to replace
 * with a fresh cart. Anything else (network failure, 5xx) is transient:
 * the token itself may still be perfectly valid. */
function isInvalidCredential(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.kind === "http" &&
    (err.status === 401 || err.status === 403 || err.status === 404)
  );
}

interface CartContextValue {
  cart: CartView | null;
  isLoading: boolean;
  error: string | null;
  source: "demo" | "live";
  token: string | null;
  itemCount: number;
  /** Throws on failure — callers must not report success without awaiting this. */
  addItem: (variantId: string, quantity: number, note?: string, customDesignId?: string) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  replaceVariant: (itemId: string, newVariantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Retry after an init failure without losing a still-valid stored token. */
  retryInit: () => void;
  completeCheckout: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const i18n = useI18n();
  // Latest translator for async error text without re-running the init effect.
  const i18nRef = useRef(i18n);
  useEffect(() => {
    i18nRef.current = i18n;
  }, [i18n]);
  const [cart, setCart] = useState<CartView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  // Guards against an older mutation's response overwriting a newer one.
  const mutationSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);

      if (stored) {
        try {
          const existingCart = await cartClient.getCart(stored);
          if (cancelled) return;
          setToken(stored);
          setCart(existingCart);
          setIsLoading(false);
          return;
        } catch (err) {
          if (cancelled) return;
          if (!isInvalidCredential(err)) {
            // Transient failure (network/server) — keep the stored token,
            // don't silently start a brand new cart over it.
            setError(apiErrorMessage(err, i18nRef.current, "cart.errors.loadBag"));
            setIsLoading(false);
            return;
          }
          // Token itself is invalid/expired — fall through to a new cart.
        }
      }

      try {
        const created = await cartClient.createCart();
        if (cancelled) return;
        window.localStorage.setItem(TOKEN_STORAGE_KEY, created.token);
        setToken(created.token);
        setCart(created.cart);
      } catch (err) {
        if (cancelled) return;
        setError(apiErrorMessage(err, i18nRef.current, "cart.errors.loadBag"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [initAttempt]);

  const retryInit = useCallback(() => setInitAttempt((n) => n + 1), []);

  /**
   * Runs a cart mutation. Rethrows on failure so callers (e.g. "Add to
   * cart" UI) never report success for a failed action — they must await
   * this and only show success once it resolves. A sequence number
   * discards any response that's no longer the latest in-flight mutation.
   */
  const run = useCallback(
    async (action: (activeToken: string) => Promise<CartView>) => {
      if (!token) throw new ApiError(i18nRef.current.t("cart.errors.notReady"));
      const mySeq = ++mutationSeq.current;
      setError(null);
      try {
        const updated = await action(token);
        if (mySeq === mutationSeq.current) setCart(updated);
      } catch (err) {
        if (mySeq === mutationSeq.current) {
          setError(apiErrorMessage(err, i18nRef.current, "cart.errors.generic"));
        }
        throw err;
      }
    },
    [token],
  );

  const addItem = useCallback(
    (variantId: string, quantity: number, note?: string, customDesignId?: string) =>
      run((t) => cartClient.addItem(t, { variantId, quantity, note, customDesignId })),
    [run],
  );

  const updateItemQuantity = useCallback(
    (itemId: string, quantity: number) =>
      run((t) => cartClient.updateItemQuantity(t, itemId, quantity)),
    [run],
  );

  const removeItem = useCallback(
    (itemId: string) => run((t) => cartClient.removeItem(t, itemId)),
    [run],
  );

  const replaceVariant = useCallback(
    (itemId: string, newVariantId: string) =>
      run((t) => cartClient.replaceVariant(t, itemId, newVariantId)),
    [run],
  );

  const applyCoupon = useCallback(
    (code: string) => run((t) => cartClient.applyCoupon(t, code)),
    [run],
  );

  const removeCoupon = useCallback(
    () => run((t) => cartClient.removeCoupon(t)),
    [run],
  );

  const refresh = useCallback(
    () => run((t) => cartClient.getCart(t)),
    [run],
  );

  /**
   * Starts a fresh cart after an order has claimed the current one. This
   * is best-effort housekeeping, not part of order success — callers must
   * navigate to the order confirmation regardless of whether this
   * succeeds (see checkout page).
   */
  const completeCheckout = useCallback(async () => {
    const created = await cartClient.createCart();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, created.token);
    setToken(created.token);
    setCart(created.cart);
  }, []);

  const itemCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        error,
        source: CART_SOURCE,
        token,
        itemCount,
        addItem,
        updateItemQuantity,
        removeItem,
        replaceVariant,
        applyCoupon,
        removeCoupon,
        refresh,
        retryInit,
        completeCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
