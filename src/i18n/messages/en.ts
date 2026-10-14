import type { DeepMessages } from "../types";
import { bundles } from "./bundles";
import { cart } from "./cart";
import { catalog } from "./catalog";
import { checkout } from "./checkout";
import { common } from "./common";
import { customize } from "./customize";
import { home } from "./home";
import { meta } from "./meta";
import { nav } from "./nav";
import { orders } from "./orders";
import { pages } from "./pages";
import { search } from "./search";
import { product } from "./product";

const source = {
  common: common.en,
  nav: nav.en,
  meta: meta.en,
  catalog: catalog.en,
  pages: pages.en,
  home: home.en,
  search: search.en,
  customize: customize.en,
  cart: cart.en,
  checkout: checkout.en,
  orders: orders.en,
  product: product.en,
  bundles: bundles.en,
};

/** Dictionary shape (plural leaves widened) that every language must satisfy. */
export type Messages = DeepMessages<typeof source>;

export const en: Messages = source;
