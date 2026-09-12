"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "@/lib/api/http";
import { cartClient, CART_SOURCE } from "@/lib/cart/cart-client";
import type { CartView } from "@/lib/cart/types";

const TOKEN_STORAGE_KEY = "cart-token";

interface CartContextValue {
  cart: CartView | null;
  isLoading: boolean;
  error: string | null;
  source: "demo" | "live";
  token: string | null;
  itemCount: number;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
  completeCheckout: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) {
          try {
            const existingCart = await cartClient.getCart(stored);
            setToken(stored);
            setCart(existingCart);
            return;
          } catch {
            // Stored token is stale/expired — fall through and start a new cart.
          }
        }
        const created = await cartClient.createCart();
        window.localStorage.setItem(TOKEN_STORAGE_KEY, created.token);
        setToken(created.token);
        setCart(created.cart);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load the cart.");
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, []);

  const run = useCallback(
    async (action: (activeToken: string) => Promise<CartView>) => {
      if (!token) return;
      setError(null);
      try {
        const updated = await action(token);
        setCart(updated);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    },
    [token],
  );

  const addItem = useCallback(
    (variantId: string, quantity: number) =>
      run((t) => cartClient.addItem(t, { variantId, quantity })),
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

  /** Starts a fresh cart after an order has claimed the current one. */
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
        applyCoupon,
        removeCoupon,
        refresh,
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
