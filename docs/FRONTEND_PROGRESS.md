# Frontend progress

## ⚠️ Known backend config issue: media URLs are `localhost`-relative

Verified live: uploading media (`POST /admin/media/upload`) and every
place that returns a `mediaAsset`/`primaryImage`/`media` field returns
URLs like `http://localhost:3010/uploads/<file>` — **this affects the
public storefront too** (`GET /products` → `primaryImage.url`), not just
the admin panel. Any client other than the backend machine itself
(this frontend included, running on a different Windows machine) will
get a broken image, since `localhost` resolves to the viewer's own
machine. Once real product photos are uploaded via the new admin media
feature (see Milestone 7), they won't display correctly on the
storefront until the backend is configured to return its real
LAN/public base URL for uploads instead of `localhost`. This is a
backend fix (likely a `PUBLIC_BASE_URL`/`MEDIA_BASE_URL` env var used
when building the URL) — not something patched around here, so it
isn't silently masked.

## Backend coverage audit (Milestone 5)

Full inventory of `phone-cases-backend` modules, cross-checked against
what this frontend actually uses, so nothing is silently missed. ✅ =
implemented, ⚠️ = partially covered, ❌ = not built yet (documented gap,
not an oversight).

| Backend module | Endpoints | Frontend status |
|---|---|---|
| Public catalog: products | `GET /products`, `GET /products/:slug` | ✅ `/phone-cases`, `/products/[slug]` |
| Public catalog: phone brands/models | `GET /phone-brands`, `GET /phone-models` | ✅ used in phone selector + filters (brands endpoint not separately called — model objects already embed brand) |
| Public catalog: collections | `GET /collections`, `GET /collections/:slug` | ✅ list used; single-collection detail endpoint unused (no per-collection page, only the filtered listing) |
| Public catalog: case types | `GET /case-types` | ✅ filter facet |
| Cart | full `cart.controller.ts` | ✅ `/cart`, `CartProvider` |
| Payment receipts (guest) | `POST /cart/receipts[/replace]`, `GET /cart/receipts/:id/file` | ✅ upload wired in checkout; replace-on-reject flow and viewing the uploaded file are **not** built (customer can't yet re-upload after a staff rejection) |
| Checkout & orders (guest) | `POST /checkout/quote`, `POST /orders`, `GET /orders/track/:token` | ✅ `/checkout`, `/orders/track/[token]`, `/track` |
| Shipping (public) | `GET /shipping-options` | ✅ checkout |
| Shipping (admin) | zones/rates CRUD | ❌ not built — no admin UI to manage shipping rates |
| Promotions: coupons (admin) | create/list/get/update | ✅ `/admin/coupons` — list, create, toggle active. Live-verified (found the real `WELCOME10` coupon already on the backend). `minSpend`/`startsAt`/`expiresAt`/`usageLimit` fields exist in the API but have no form inputs yet — only code/type/value at creation. |
| Promotions: bundles (admin) | full CRUD | ❌ not built |
| Auth & staff | login/refresh/logout/me | ⚠️ login implemented; `refresh`/`logout`/`me` endpoints exist but aren't called — session just expires after `expiresIn` (15 min) and the user re-logs in. No silent token refresh yet. |
| Staff management (admin) | create/list/get/update staff | ❌ not built — only the seeded `OWNER_ADMIN` can be used to sign in |
| Admin orders | list/detail/fulfillment/payment/receipt-reject/flag-late-payment/sweep-expired | ✅ all except `sweep-expired` (an operational/cron-style action, not a natural UI button) |
| Refunds & returns (admin) | create/list refunds; create/list item returns | ❌ not built |
| Admin catalog: products | create/list/get/update/status/attach-collection | ✅ create (`/admin/products/new`), list, detail, status update (`/admin/products/[id]`). `PATCH` full field edit (name/description/basePrice) and `attach-collection` are **not** built yet — only status changes. |
| Admin catalog: variants | create/update | ✅ create (with real phone-model/case-type dropdowns, sourced from the live public catalog) + active/inactive toggle. Price/compareAtPrice/SKU editing after creation is **not** built. |
| Admin catalog: media | upload/attach/detach (product), attach/detach (variant), list, delete | ✅ upload+attach+detach for **products**, live-verified (see the `localhost` URL warning at the top of this file). Variant-level media (`/admin/media/variants/...`), the standalone media library list/delete, and reordering/re-choosing primary are **not** built. |
| Inventory: stock items | adjust, movements, reservations | ⚠️ adjust only (`/admin/stock`, needs a stock-item id typed in manually — no browser to look one up) |
| Inventory: reservations (admin) | sweep-expired | ❌ not built (operational action) |
| Content: homepage sections (admin + public) | full CRUD + public read | ❌ not built either side — this frontend's homepage is hand-built to match the approved design reference rather than driven by backend CMS content, per the original brief. If the business later wants the homepage editable from the backend, this is the module to wire up. |
| Content: pages (admin + public) | full CRUD + public read | ⚠️ public read only, new this pass (`/pages/[slug]`, `src/lib/data/pages.ts`) — renders any published page. **No admin UI to create pages yet**, and no live pages exist to test against (`GET /pages` currently returns `[]` on the backend). Footer links (About/Help/Privacy/Terms) are **not** pointed at real slugs yet since no real slugs exist — wire them once content is published and slugs are known. |
| Audit log (admin) | `GET /admin/audit-log` (inferred from module) | ❌ not built |

**Net read on "is anything from the backend missed silently":** no — every
module above is accounted for, either implemented or explicitly marked
as a documented gap with the reason. The gaps are concentrated in
back-office CRUD (bundles, coupons, shipping zones, staff, media,
refunds, homepage/pages authoring) — all lower-priority than the
customer-facing storefront and the order-management basics, which are
the parts a real store cannot operate without.

---

## Milestone 1 — shared visual foundations + homepage

### Completed sections

- Header: wordmark, primary nav, search/bag icon buttons (routed to an
  honest `/coming-soon` page), responsive mobile menu (opens/closes,
  closes on `Escape` and on link click, animated height transition).
- Hero: headline, supporting copy, "Shop the collection" CTA (scrolls to
  `#collections` — a real, implemented destination), original vector
  product-collage illustration with orange/peach geometric accents.
- Phone selector ("Find your phone"): compact `<select>`, local React
  state, demo-data notice shown when not backed by live data.
- Collections ("Pick your mood"): 3 asymmetric image-led tiles (labels
  DIFFERENT/CALM/BOLD come from data, not hardcoded per-component
  strings — see `src/lib/demo/collections.demo.ts` and
  `src/lib/data/collections.ts`), "View all collections" link.
- Featured products ("Caught our eye"): 4-col desktop / 2-col mobile
  grid, product artwork, name, compatibility; live prices render only
  when `source === "live"` (see Data contract below) — demo mode never
  shows a fabricated price as if real.
- Footer: dark background, large outlined wordmark, nav/info links.

### Verified backend contract (read from GitHub, not assumed)

Inspected directly from `Ahmedkhalaf2-1/phone-cases-backend` (NestJS):
`docs/API.md`, `src/main.ts`, and the public controllers under
`src/modules/catalog/**-public.controller.ts`.

- Global prefix: `/api`; versioned base: `/api/v1`. Default port `3010`.
- `GET /products` → `{ items: PublicProductSummary[], meta }`
  (`id, slug, name, description, currency, effectivePriceFrom,
  isAvailable, primaryImage, collections[]`).
- `GET /products/:slug` → adds `media[]`, `variants[]`
  (variant has `phoneModel`, `caseType`, `price`, `compareAtPrice`,
  `thumbnail`).
- `GET /phone-models?brandId=` → `{ id, slug, name, releaseYear, brand }`.
- `GET /phone-brands` → `{ id, slug, name }`.
- `GET /collections` / `GET /collections/:slug` → `{ id, slug, name,
  description }` — **no imagery field**.
- `GET /homepage-sections?locale=` / `GET /pages` — not consumed this
  milestone (homepage layout here follows the approved design reference,
  not backend-authored homepage content, per the brief).

Types mirroring this contract: `src/lib/api/types.ts`. The data-access
boundary (`src/lib/data/*.ts`) is the only place that decides demo vs.
live per resource; components only ever receive already-typed data.

### Data: live vs. demo

- `NEXT_PUBLIC_DEMO_MODE=true` (current default in `.env.local`) — every
  section renders local fixtures from `src/lib/demo/*.demo.ts`, shaped
  exactly like the verified live types. This is explicit, not a fallback
  from a failed request.
- `NEXT_PUBLIC_DEMO_MODE=false` — sections call the backend via
  `src/lib/api/http.ts` (`buildApiUrl` guarantees `/api/v1` appears
  exactly once regardless of trailing slashes). A failed request throws
  `ApiError` and surfaces via `src/app/error.tsx` — it is never caught
  and replaced with fake success data.
- Backend base URL is configured as
  `NEXT_PUBLIC_API_BASE_URL=http://192.168.1.7:3010/api/v1` (Ubuntu
  machine on the local network). **That backend was not running during
  this milestone** — live mode is wired but unverified end-to-end; only
  demo mode has actually been exercised.
- Collections have no live imagery field, so live-mode collection tiles
  fall back to the same placeholder artwork set as demo mode, rotated by
  index (`src/lib/data/collections.ts`). This is a known gap, not
  invented backend behavior.

### Temporary / placeholder assets

No product photography, collection imagery, or brand mark was supplied
beyond `refrenace.png` (a design reference, not a usable asset). Every
image on the homepage is original inline SVG illustration written for
this milestone (`src/components/graphics/PhoneCaseIllustration.tsx`,
`MoodTileArt.tsx`) — not slices of the reference screenshot, not
third-party product photos.

Real assets needed before this can look production-ready, with the exact
composition to preserve:
- **Hero collage**: two product photos on an orange field, one leaning
  checkerboard-pattern case (front, larger, upper-left) and one red case
  (behind/lower-right), roughly the crop/scale in `refrenace.png`.
- **3 collection tiles** (Different / Calm / Bold): editorial lifestyle
  photography, portrait-ish crop, one wide (spans 2 of 4 grid columns).
- **4 featured product shots**: square, on a `#F3F2EF` background, one
  case per product (Check / Cherry / Orbit / Sage in the reference — the
  business owner's actual first four SKUs may differ).
- **Brand mark**: the orange asterisk/sparkle symbol next to the
  wordmark is currently a text glyph (`✳`), not a vector logo.

Asset paths are centralized in the demo fixtures / graphics components
above so swapping in real files touches only those files.

### Unfinished / disabled routes (as of milestone 1)

Routed to `/coming-soon` at the time: Phone Cases (nav), Track Order,
search, shopping bag, View all collections, individual collection tiles,
individual product cards. Milestone 2 (below) replaced most of these with
real pages.

---

## Milestone 2 — store & product page

### Completed

- **`/phone-cases`** — product listing page: search (`q`), filters
  (`collection`, `phoneModel`, `caseType`, `availableOnly`), sort
  (`newest` / `price_asc` / `price_desc`), pagination (`page`) — all as
  real URL query params so listings are linkable/shareable/back-button
  safe. Filters are a client component (`ProductFilters`) that pushes
  URL updates; the listing itself is server-rendered per request.
- **`/products/[slug]`** — product detail page: gallery, description,
  collection chips (link back into the filtered listing), and a
  `VariantPicker` (client component) that lets the visitor choose a
  phone model and case type and see that combination's real price,
  compare-at price, and stock status update live. No combination is
  invented — the picker only offers combinations that exist among the
  product's actual `variants[]`.
- "Add to cart" — implemented in milestone 3, see below.
- Homepage and header now link to real destinations instead of
  `/coming-soon` where a real page exists: header "Phone Cases" →
  `/phone-cases`, "New In" → `/phone-cases?sort=newest`, collection
  tiles → `/phone-cases?collection=<slug>`, "View all collections" →
  `/phone-cases`, featured-product cards → `/products/<slug>`, and the
  homepage phone selector's "Shop this model" →
  `/phone-cases?phoneModel=<slug>`.
- `GET /case-types` added to the verified contract (`id, slug, name,
  description`) and wired as a new filter facet.
- `getProducts()` / `getProductBySlug()` added to
  `src/lib/data/products.ts` following the same demo/live split as
  every other resource; `getProductBySlug` returns `null` on a live
  `404` (rendered via `notFound()`), never a fabricated product.

### Demo-mode filtering caveat

In demo mode, filtering/sorting/pagination are computed in
`src/lib/data/products.ts` (`filterDemoProducts`) over the 4 fixture
products — this logic does not exist in live mode, where `GET /products`
does the filtering server-side. This is intentional (demo mode has no
server to call) but means demo-mode filter *behavior* isn't a proof that
the live query params are wired correctly end-to-end — that still needs
verification against a running backend (see Milestone 5).

### Unfinished / disabled routes (as of milestone 2)

Still routed to `/coming-soon` at the time: Track Order, search, shopping
bag. Milestones 3–4 (below) replaced Track Order and shopping bag with
real pages.

---

## Milestone 3 — cart & bundles

### Completed

- Verified the cart contract directly from source: `cart.controller.ts`
  (routes + `X-Cart-Token` header auth via `CartTokenGuard`) and
  `cart-pricing.service.ts` (`CartView`/`CartItemView` field names).
  Types live in `src/lib/cart/types.ts`.
- `src/lib/cart/live-cart-client.ts` — real client for
  `POST /cart`, `GET /cart`, `POST/PATCH/DELETE /cart/items[/:id]`,
  `POST/DELETE /cart/coupon`, using the new `apiRequest()` helper added
  to `src/lib/api/http.ts` (supports non-GET methods, JSON and
  multipart bodies, and surfaces the backend's own validation message
  text instead of a generic one).
- `src/lib/cart/demo-cart-client.ts` — a **local, `localStorage`-backed
  simulation** with the identical method signatures, used only in demo
  mode (backend offline). It is explicitly documented as a simulation,
  not a second implementation of backend business logic: it supports
  one demo coupon (`WELCOME10`, 10% off) and always reports
  `bundleDiscountTotal: 0` — real bundle math is server-only and isn't
  reproduced client-side, in demo or live mode.
- `CartProvider` (`src/lib/cart/CartProvider.tsx`) — app-wide React
  context (wrapped around the app in `layout.tsx`) that owns the cart
  token (persisted in `localStorage`, not a cookie — matches the
  backend's own token model), loads/creates the cart on first render,
  and exposes `addItem`/`updateItemQuantity`/`removeItem`/
  `applyCoupon`/`removeCoupon`/`refresh`. A stale/expired stored token
  is detected and silently replaced with a **new empty cart** (not with
  fake cart *contents* — this is session recovery, not data
  fabrication).
- **`/cart`** page: line items with thumbnail, quantity stepper (capped
  at 20, matching `MAX_CART_ITEM_QUANTITY`), remove, coupon apply/remove
  surfacing `couponWarning` exactly as the backend returns it (coupons
  are never silently dropped), subtotal/discount/bundle-discount/total,
  and a "Checkout" link.
- **`VariantPicker`** on `/products/[slug]` now has a working quantity
  stepper and "Add to cart" wired to `CartProvider.addItem` — this
  replaces the disabled placeholder from milestone 2.
- Header shopping-bag icon now links to `/cart` and shows a live item
  count instead of routing to `/coming-soon`.

### Demo-mode honesty notes

- The demo cart is visibly labeled on `/cart` ("Demo mode — this cart is
  simulated locally in your browser... It is not a real order.").
- It is a genuinely interactive simulation (not a static mock) so the
  cart/checkout UI can be exercised end-to-end before a backend is
  reachable — but it never calls the backend and never claims to.

---

## Milestone 4 — checkout & tracking

### Completed

- Verified `checkout.controller.ts`/`.service.ts` (quote shape),
  `orders-public.controller.ts` + `order-response.mapper.ts` (guest
  order view), `shipping-public.controller.ts`, `create-order.dto.ts`,
  and `receipts-cart.controller.ts` directly from source. Types added to
  `src/lib/cart/types.ts` (`ShippingOption`, `CheckoutQuote`,
  `CreateOrderInput`, `GuestOrderView`).
- `liveCartClient` extended with `getShippingOptions`, `checkoutQuote`,
  `uploadReceipt`/`replaceReceipt` (real `multipart/form-data`, field
  name `file`, matching the backend's Multer config), `createOrder`,
  `trackOrder`. `demoCartClient` extended with matching demo behavior
  (two fixture shipping rates, a simulated quote/order, and orders
  persisted to `localStorage` keyed by tracking token).
- **`/checkout`** — single-page checkout: contact + Egypt-only shipping
  address form, shipping-rate selection (`GET /shipping-options`),
  a live `POST /checkout/quote` recomputed whenever the rate changes
  (never assumes shipping is free or a fixed number), and a payment
  step (Cash on Delivery, or InstaPay Manual with real receipt upload
  gating order submission — matching the backend rule that
  `receiptId` is required for `INSTAPAY_MANUAL`). Order placement uses
  a real per-submission `idempotencyKey` (`crypto.randomUUID()`) and
  sends `expectedTotal` from the live quote so a stale-price race is
  caught by the backend's own `PRICE_CHANGED` check, not hidden.
  Checkout is blocked (submit disabled, reason shown) if the quote
  reports unavailable items via `issues[]` — no silent skipping of bad
  lines.
- **`/orders/track/[token]`** — real order-tracking page rendering both
  independent status machines (`fulfillmentStatus`, `paymentStatus`)
  exactly as returned, line items, shipping address, and receipt review
  status. Reached automatically right after checkout, and also via:
- **`/track`** — a tracking-token entry form (the header's "Track
  Order" link, previously `/coming-soon`, now points here).
- After a successful order, `CartProvider.completeCheckout()` clears the
  claimed cart token and starts a fresh empty cart, since the backend
  atomically transitions the used cart from `ACTIVE` to `ORDERED`.

### Demo-mode honesty notes

- A demo order's confirmation banner explicitly states: "this is a
  simulated order confirmation stored only in your browser. No real
  order was placed and no backend was contacted." This directly
  satisfies the "no simulated order confirmation [presented as real]"
  constraint from the project brief — the simulation exists, but it is
  never allowed to look real.
- Demo shipping only offers 2 fixture rates for a hardcoded `EG`
  country; live mode calls the real `GET /shipping-options?country=EG`.

### Verification limits (both milestones)

`/cart`, `/checkout`, and `/orders/track/[token]` are client components
(cart state lives in `localStorage`, which only exists in a real
browser). `curl`-based smoke tests here only confirm the routes return
`200` and the correct static shell — they cannot exercise add-to-cart,
coupon, or checkout submission, since that requires executing
JavaScript in a browser. No headless-browser tool is available in this
environment, so **the actual add-to-cart → cart → checkout → order →
tracking flow has not been click-tested**. Please verify this manually
before relying on it.

### Unfinished / disabled routes (as of milestone 4)

Still routed to `/coming-soon`: search. Everything else the storefront
links to now has a real destination.

---

## Milestone 5 — admin panel, live backend verification, coverage audit

### Live backend verification

The backend at `NEXT_PUBLIC_API_BASE_URL` (`http://192.168.1.7:3010/api/v1`)
went from unreachable to live during this milestone. Fixed along the way
(by the backend operator, not this frontend):
1. **Firewall** — port 3010 wasn't reachable over the LAN even though the
   NestJS process was correctly bound to `0.0.0.0`; opening `3010/tcp` in
   `ufw` fixed it.
2. **CORS** — `CORS_ORIGINS` didn't include `http://localhost:3000`, so
   browser-side calls (cart/checkout) were silently blocked while
   server-rendered pages (homepage, listings) worked fine, since only
   the former go through the browser's CORS enforcement. Fixed by adding
   the origin and restarting the backend.

Verified directly against the live backend (not assumed): `/health`,
`/products`, `/phone-models`, `/collections`, `/case-types`,
`POST /cart` → `POST /cart/items` → response shape, `/shipping-options`,
and (using the seeded `OWNER_ADMIN` account) `/auth/login`,
`/admin/orders`, `/admin/products` — all match the types in
`src/lib/api/types.ts`, `src/lib/cart/types.ts`, and
`src/lib/admin/types.ts` exactly. `NEXT_PUBLIC_DEMO_MODE` is now `false`
in `.env.local`.

One correction made from live data: `ReceiptStatus` is
`PENDING_REVIEW | ACCEPTED | REJECTED` (not `APPROVED` as first guessed
from docs alone) — fixed in `src/lib/cart/types.ts`.

The live catalog currently has mostly backend test/seed fixtures (e.g.
"Stocked Test", "Order Test", "LiveCheck", "Space") with only one
in-stock product and one real collection ("New Arrivals") — this is
real inventory state, not a frontend bug, so the homepage's "Pick your
mood" section will look sparse (1 tile) and "Caught our eye" will show
1 product until the shop owner adds real catalog data.

### Admin panel (`/admin`)

- `POST /auth/login` wired via `AdminAuthProvider` (`src/lib/admin/`),
  session (`accessToken`, `refreshToken`, `staff`) persisted in
  `localStorage`. **No auto-refresh yet** — `expiresIn` is 15 minutes,
  after which staff must sign in again (documented gap, see audit table
  above).
- Route-group auth guard in `src/app/admin/layout.tsx` redirects to
  `/admin/login` when signed out.
- `/admin/orders` — list with fulfillment/payment status filters.
- `/admin/orders/[id]` — update fulfillment status (any admin role) and
  payment status (`OWNER_ADMIN` only, UI-disabled for other roles rather
  than hidden, matching the backend's own role gate), flag late payment,
  reject a pending receipt.
- `/admin/products` — read-only list (create/edit intentionally not
  built this pass, see audit table).
- `/admin/stock` — manual stock adjustment by stock-item id (no
  stock-item browser yet, so the id must be known/copied in).
- The admin panel **always talks to the live backend** — there is no
  demo-mode admin, since staff auth and order/inventory mutations are
  consequential actions that must never be simulated.

### New public route

- `/pages/[slug]` — real `GET /pages/:slug` integration (see coverage
  audit above for its current limits).

---

## Milestone 6 — admin product/variant/coupon CRUD

### Completed

- `/admin/products/new` — create a product (`POST /admin/products`).
- `/admin/products/[id]` — status changes (`PATCH .../status`), add a
  variant (`POST .../variants`), toggle a variant active/inactive
  (`PATCH .../variants/:id`).
- `/admin/coupons` — list, create, toggle active
  (`GET/POST/PATCH /admin/coupons`).
- All of the above **live-verified** with real `curl` calls against the
  backend using the seeded `OWNER_ADMIN` account (created a real test
  product, added a real variant, published it, confirmed each response
  matches the frontend's types exactly) before wiring the UI.

### Known limits of this pass

- No product field editing after creation (name/description/price) —
  only status.
- No collection attach/detach from the admin UI.
- Variant creation needs a raw phone-model/case-type UUID typed in —
  there's no picker, since building one needs the phone-models/case-types
  admin list wired in too.
- No media upload — a product can be fully created and published from
  this UI with zero images.
- No stock-item creation from the UI (`/admin/stock` can only adjust an
  *existing* stock item by id).

### Next milestone

See Milestone 7 below — media upload landed. Remaining ❌ items, in
order of usefulness: bundle admin CRUD, refunds/returns admin UI,
shipping-zone admin UI, product field editing, then staff management
and homepage/pages CMS authoring.

---

## Milestone 7 — admin media upload + real phone-model/case-type pickers

### Completed

- Product detail page (`/admin/products/[id]`) can now upload an image
  (`POST /admin/media/upload`, JPEG/PNG/WebP, 5MB limit matching the
  backend) and attach it to the product in one action
  (`POST /admin/media/products/:id`), shows attached images with a
  "Primary" badge, and can detach one
  (`DELETE /admin/media/products/:id/:mediaAssetId`).
- Variant creation now uses real `<select>`s populated from the live
  public catalog (`GET /phone-models`, `GET /case-types`) instead of
  raw UUID text fields.
- All of the above live-verified end-to-end against the backend
  (uploaded a real test image, attached it, confirmed it appears on
  both the admin product and the **public** `GET /products/:slug`
  response, then detached and deleted it to leave the backend clean).
- **Found a real backend config issue while verifying** — see the
  warning banner at the top of this file: uploaded media URLs are
  `http://localhost:3010/...`, which breaks images for every client
  except the backend machine itself. This affects the storefront's
  product images too, not just admin, once real photos are uploaded.

### Known limits of this pass

- No variant-level media (only product-level).
- No standalone media library (list all uploads / delete unattached
  ones) — upload only happens inline while attaching to a product.
- No reordering or "make primary" after the first upload — the first
  image attached is automatically primary; later ones aren't.

### Next milestone

Bundle admin CRUD, refunds/returns admin UI, shipping-zone admin UI,
product field editing (name/description/price after creation), staff
management, homepage/pages CMS authoring — plus flagging the
`localhost` media-URL issue to whoever manages the backend, since it
blocks real product photography from displaying correctly until fixed
there.
