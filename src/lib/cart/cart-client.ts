import { DEMO_MODE } from "@/lib/env";
import { liveCartClient } from "@/lib/cart/live-cart-client";
import { demoCartClient } from "@/lib/cart/demo-cart-client";

/** Selects the demo or live cart implementation. Never mixes the two. */
export const cartClient = DEMO_MODE ? demoCartClient : liveCartClient;

export const CART_SOURCE: "demo" | "live" = DEMO_MODE ? "demo" : "live";
