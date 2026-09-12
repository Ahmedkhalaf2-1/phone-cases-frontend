# Frontend progress

## Milestone 10 — bounded 401 recovery, catalog/inventory admin, homepage CMS wiring

Follow-up to a review that milestone 9's delivery (commit `488dcbf`)
left several explicitly requested workflows unfinished. Everything
below was implemented, not just documented; verified with one final
`tsc`/`eslint`/`build` pass (all clean) at the end. No commit was made —
changes are left local per instruction.

### Shared bounded 401 recovery (`authorizedFetch`)

`AdminAuthProvider` gained `authorizedFetch(fn)`: every admin page now
calls the client through it instead of reading `accessToken` and
calling `adminClient.x(accessToken, ...)` directly. On a 401 it
refreshes once (never on 403) and retries the call exactly once;
concurrent 401s across multiple in-flight requests share one refresh
via an in-flight-promise guard, not one refresh per request. A
`loggedOutAt` timestamp captured before each refresh attempt is
compared after the refresh resolves — if it changed (the user logged
out mid-refresh), the stale refreshed session is discarded instead of
resurrecting a signed-out session. Cross-tab session sync (existing
`storage` listener) and the real `POST /auth/logout` call on sign-out
are preserved. Rolled out to all 15 admin pages that make authenticated
calls.

### Catalog administration (new)

- `/admin/catalog/brands`, `/admin/catalog/models`, `/admin/catalog/case-types`,
  `/admin/catalog/collections` — full list + create + activate/deactivate
  screens against `/admin/phone-brands`, `/admin/phone-models`,
  `/admin/case-types`, `/admin/collections`, verified live against the
  real backend (all four share `{id, slug, nameEn, nameAr, displayOrder,
  isActive, createdAt, updatedAt}` plus entity-specific fields). Phone
  models use a real brand `<select>`, not a pasted brand id.
- `/admin/products/[id]` — product↔collection association added
  (attach via a readable `<select>` of admin collections, detach with a
  ×), using the backend's real `POST/DELETE
  /admin/products/:id/collections[/:collectionId]`.

### Variant editing (was create + active-toggle only)

`/admin/products/[id]` variants now have a full inline "Edit" form:
SKU, price, compare-at price, phone model, case type, active, and
stock (unlimited vs. a specific stock item) via `PATCH
/admin/products/:productId/variants/:variantId` (all fields optional
in the backend's DTO, confirmed from source — nothing is
immutable here). Unlimited-stock and stock-item association are
mutually exclusive in the UI (checking "unlimited" clears the selected
stock item and disables that dropdown, matching the backend rule that
both can't be set together). Duplicate-SKU/invalid-combination backend
errors surface as-is instead of a generic message.

### Inventory administration (was adjust-by-pasted-uuid only)

`/admin/stock` rebuilt: browse all stock items (SKU, on-hand, reserved,
available), create a new stock item, and — for the selected item — see
on-hand/reserved/available, adjust with a required non-empty reason
(validated client-side), and view movement history and active/
released/expired/consumed reservations. No stock movements were
created except the one adjustment used to verify the form live, which
was left as real created state (append-only ledger — there's no delete
endpoint to clean it up, consistent with the backend's audit design).

### Bundles & coupons — exposed the remaining backend-supported fields

- Bundles: eligible variants are now a readable checkbox list (product
  name + SKU) instead of pasted UUIDs, each with an optional per-variant
  `MoneyInput` surcharge, plus `requireDifferentPhoneModels`,
  `isRepeatable`, `allowCouponStacking` toggles — all real `CreateBundleDto`
  fields that had no form control before.
- Coupons: added `minSpend` (`MoneyInput`), `startsAt`/`expiresAt` (date
  range), `usageLimit` to the create form and the list table.

### Shipping — edit and activate/deactivate existing zones/rates

Verified `PATCH /admin/shipping-zones/:zoneId` and `PATCH
/admin/shipping-zones/:zoneId/rates/:rateId` directly from the
backend's controller/DTO source (both accept a partial of the create
DTO, including `isActive`) before adding `updateShippingZone`/
`updateShippingRate` to the admin client. `/admin/shipping` now has
inline edit forms for an existing zone (name/countries) and rate
(name/price/free-shipping threshold/estimated days), plus an
active/inactive toggle for both — previously only creation existed.

### Admin receipt viewer (was: status badge only, no image)

Added `getReceiptFile(accessToken, receiptId)` to the admin client — a
raw `fetch` with an `Authorization` header (receipt bytes can't load
via a plain `<img src>`, verified from `receipts-admin.controller.ts`:
`GET /admin/receipts/:receiptId/file`, JWT-guarded). New
`ReceiptViewer` component loads the blob, renders a thumbnail, and
opens an enlarged lightbox on click; the object URL is revoked on
unmount/re-fetch. Wired into `/admin/orders/[id]`, which now shows
every receipt's thumbnail, status, rejection reason (if any), and
upload timestamp — not just the pending ones needing action. Payment
confirmation stays an explicit separate staff action (setting payment
status to PAID) — approving a receipt was never a thing the backend
does automatically, and this still doesn't add one.

### InstaPay recipient — centralized, still honestly unconfigured

Moved `INSTAPAY_RECIPIENT` out of `checkout/page.tsx` and into
`src/config/site.ts` (same file already used for brand name/nav/footer
config) so a future real recipient is a single edit, not a
per-component one. Still `null` — no recipient exists anywhere in the
backend (re-verified: no env var, settings endpoint, or seed data) — so
checkout continues to show the honest "not configured" state and
disables that path; Cash on Delivery is unaffected. The customer-side
receipt-replacement flow (`orders/track/[token]`, using the preserved
original cart credential from `order-credentials.ts`) was reviewed
against this session's requirements and was already correct from
milestone 9 — no changes needed.

### Homepage sections — now rendered on the real homepage

This was the biggest documented gap from milestone 9 ("sections
created here have no visible effect on the site"). Verified the public
contract directly (`homepage-sections-public.controller.ts`:
`GET /homepage-sections` returns only `isEnabled: true` sections,
sorted by `displayOrder`, with `{id, type, title, body, linkUrl,
displayOrder, media}`; `HomepageSectionType` is exactly `BANNER |
PROMO_STRIP`, confirmed from `schema.prisma`). Added
`getEnabledHomepageSections()` (returns `[]` in demo mode and on a CMS
fetch failure — never fabricated placeholder content) and a new
`CmsHomepageSections` component that maps each type onto the existing
reference design rather than a generic page builder: `PROMO_STRIP`
renders as a thin dark announcement bar above the header; `BANNER`
renders as a full-width image/title/body panel between "Pick your
mood" and "Caught our eye". No enabled sections means nothing renders
— the hero/collections/featured-products composition is unchanged
when the CMS has nothing published. The admin page's "not wired yet"
warning was removed and replaced with accurate placement copy; its
create/edit forms also gained `type`, `body`, `linkUrl`, and a banner
image upload (previously title-only, always created as a disabled
BANNER).

### Sections re-verified, not changed (already correct)

- Checkout idempotency, quote staleness/reconfirmation, discount
  display, and cart/checkout/tracking total breakdowns — all already
  correct from milestone 9; re-read against this session's spec and no
  defect found.
- SEO/config basics (sitemap pagination via real pagination `meta`, not
  a silent 100-item cap; `noindex` on `/admin/**`, `/checkout`,
  `/orders/track/**`; out-of-stock-but-published products still listed)
  — already correct, re-confirmed by reading the current route files.

### Verification performed this session

- `npx tsc --noEmit` — clean (one run, no errors after fixes).
- `npx eslint .` — clean (one run, exit 0).
- `npm run build` — succeeded, all 30 routes compiled (one run).
- No browser/screenshot tool is available in this environment (a probe
  for `playwright`/`chromium-cli` found nothing installed, and
  installing a browser for a one-off visual check was judged out of
  scope for a "leave uncommitted, don't add dependencies" pass). Visual
  correctness of the new admin screens, the receipt lightbox, and the
  homepage banner/promo-strip placement at ~1440px/~390px has **not**
  been confirmed in an actual browser — please check manually,
  especially: the variant edit form's field wrapping on mobile, the
  receipt thumbnail/lightbox sizing, and the new banner's text contrast
  over an uploaded image.
- No production mutations beyond what milestone 9 already documents;
  this session created zero new orders/refunds/returns/stock-movements
  for testing beyond reading existing live data.

## Milestone 9 — visual rebuild, checkout/cart/auth reliability, remaining admin gaps

Prompted by an owner review that the storefront didn't reproduce the
reference's composition/imagery, and a punch list of concrete
purchase-flow and admin gaps. Everything below was implemented directly
(not just proposed), verified with `tsc`/`eslint`/`build`, and — where
a live backend call was involved — with real `curl` requests against
the backend, same discipline as every earlier milestone.

### Visual rebuild

- **Hero** rebuilt from scratch: real headline/CTA/nav stay as
  components; the product visual is now a **temporary cropped photo**
  from `refrenace.png` (`public/temp-reference/hero-collage.webp`) —
  the orange backdrop, peach circle, sparkle, and both cases, with the
  page's own captions cropped out to avoid duplicating text. Documented
  inline in `Hero.tsx` as temporary, not a claim of real product
  photography. Container widened to the requested ~1440px max-width
  (was 1280px) and hero height brought down to a realistic ~500px band
  instead of a tall portrait card — no `min-height: 100vh`, no
  `scaleX()` font stretching.
- **"Pick your mood" tiles**: same treatment — real cropped photos
  (`mood-different/calm/bold.webp`) with the reference's own captions
  cropped out, real HTML title/tagline overlaid. **Fixed a real layout
  bug**: tiles used `aspect-4/5`, so the wide (2-column) "Bold" tile was
  nearly *twice as tall* as the two narrow tiles — spec explicitly
  wants consistent height across the row. Now uses a fixed height
  (`h-60`/`sm:h-80`/`lg:h-[340px]`) regardless of column span. Mobile
  layout fixed to 2-up + full-width third tile (was single-column
  stacking only, since no mobile grid-cols were set at all).
- **Featured products**: demo products now carry real image URLs
  (`product-check/cherry/orbit/sage.webp`, same crop-and-document
  approach) instead of a separate hand-drawn-SVG code path — this also
  deleted a whole component (`PhoneCaseIllustration.tsx`) that existed
  only to fake product photography, which the review specifically
  flagged as not acceptable.
- **Product detail page**: replaced the single static image with
  `ProductGallery` — thumbnail strip when a product has multiple
  images, and picking a variant with its own photo swaps the main image
  (falls back to the gallery selection otherwise). Handles accessories
  correctly now (see Fixes below).
- **Header**: search icon now opens a real inline search form
  (`/phone-cases?q=...`) instead of linking to "not available in this
  development milestone" — that exact phrase was customer-facing via
  `aria-label`, i.e. read aloud by screen readers. Bag icon is no
  longer `hidden` below the `sm:` breakpoint — on a real phone it was
  invisible unless the hamburger menu was opened first. Closed mobile
  menu now uses the HTML `inert` attribute so its links leave the tab
  order (collapsing height alone still left them keyboard-focusable).
  "Collections" nav link changed from a bare `#collections` (only
  worked already-on-homepage) to `/#collections` (works from any page).
- **Footer**: About/Help/Privacy/Terms now point at `/pages/<slug>`
  (real CMS route, honest "not published yet" state) instead of the
  generic `/coming-soon` — per the instruction not to route pages with
  real page routes to a generic placeholder.
- Brand name restored to "Contrast" (an earlier uncommitted edit in the
  working tree had reverted it to the placeholder "YOUR BRAND"; the
  owner explicitly set it to "Contrast" earlier in this project).

### Checkout/cart/auth reliability fixes (section 11-13 of the review)

- **Idempotency key was regenerated on every submit** — fixed: a stable
  key is now derived once per distinct payload (hashed with FNV-1a, not
  stored raw — no address/PII persisted) and reused across retries of
  the *same* submission via `sessionStorage`; a genuinely changed
  payload gets a new key automatically.
- **Order success depended on the next cart being created** — fixed:
  `completeCheckout()` (housekeeping for the next cart) now runs
  fire-and-forget *after* navigating to the confirmation page; its
  failure can never turn into "could not place order" for an order
  that actually succeeded.
- **No real quote-staleness tracking** — added explicit
  loading/stale state; submit is disabled while a new quote is
  in-flight, and the quote now re-fetches on cart/coupon changes too,
  not just a shipping-rate change.
- **`ApiError` carried no backend error code** — extended to parse the
  `code`/`details` fields from the backend's structured error body.
  `PRICE_CHANGED` now shows the fresh total and requires an explicit
  "Confirm new total" click before resubmitting (with a new
  idempotency key, since the payload genuinely changed) — never loops
  silently on the stale `expectedTotal`.
- **Cart discarded a valid token on any fetch failure** — fixed: only
  401/403/404 (an actually-invalid credential) triggers starting a new
  cart; a network/5xx failure now keeps the existing token and shows a
  retry control instead.
- **"Added to cart" could show after a failed add** — `CartProvider`
  mutations now rethrow on failure (previously swallowed into a
  context-level error string only); `VariantPicker` catches that and
  shows the error state instead of a false success message. Same fix
  applied to the cart page's quantity/coupon/remove actions (the coupon
  form could also get stuck on "applying…" forever if the request
  failed, since there was no `finally`).
- **Concurrent/stale cart mutations could corrupt visible state** —
  added a sequence-number guard so an older in-flight mutation's
  response can never overwrite a newer one's.
- **Demo and live cart tokens shared one localStorage key** — now
  namespaced by mode (`cart-token:demo` / `cart-token:live`).
- **No way to change an existing cart item's variant** — added,
  using the backend's actual atomic
  `PATCH /cart/items/:id/variant` (not a remove-then-add pair).
- **Accessories (no phoneModel) were unbuyable** — `VariantPicker`
  required selecting a phone model even when a product had none; fixed
  to detect model-less variants and skip straight to the single
  variant.
- **Admin token refresh restarted a full lifetime on every page
  load** — fixed to track an absolute expiry timestamp and schedule
  against the *remaining* time; concurrent refreshes are deduplicated
  via a shared in-flight promise; a refresh result is discarded if the
  user logged out while it was in flight; other tabs pick up a
  rotated/cleared session via a `storage` event listener.
- **Admin logout never called the backend** — now calls
  `POST /auth/logout` (revokes the refresh token server-side) before
  clearing local state; local state clears even if that call fails.
- **InstaPay recipient details** — verified directly against the
  backend source: none exist anywhere (no env var, settings endpoint,
  or seed data). Rather than invent one, the payment step shows an
  honest "not configured" state and disables that path; Cash on
  Delivery stays usable. Documented in `CheckoutPage` so this isn't
  mistaken for an oversight.
- **Order tracking**: added a manual refresh control, a "copy tracking
  link" button, and — the hard one — a **rejected-receipt replacement
  flow**. This needed a real fix: `POST /cart/receipts/replace` is
  guarded by the *original* cart's token, which `CartProvider` already
  discards right after checkout. Added
  `src/lib/cart/order-credentials.ts` to preserve that specific token
  (localStorage, keyed by tracking token, never in the URL) *before*
  it's replaced, specifically so this flow has something to authorize
  with later. If it's genuinely unavailable (different device/browser,
  storage cleared), the page says so honestly instead of faking success.
- Cart/checkout/tracking totals now consistently show subtotal, coupon
  discount, and bundle discount as separate lines everywhere (tracking
  page was missing both; checkout was missing bundle discount) — the
  grand total itself was always server-authoritative already, so there
  was never a double-subtraction risk, just an inconsistent breakdown
  display.

### Admin: remaining workflows completed

- **Audit log** (`/admin/audit-log`, OWNER_ADMIN only) — new, against
  `GET /admin/audit-logs`, paginated.
- **Money inputs**: new shared `MoneyInput` component — operators now
  type/read whole EGP everywhere money is entered (bundle fixed total,
  shipping rate price, product base price, variant price, fixed-amount
  coupon value); minor-unit conversion happens once, at the API
  boundary, via `Math.round(egp * 100)` to avoid float drift. Percentage
  coupons stay a plain 1–100 integer (not money). **This was a real
  bug**: the bundle/shipping/variant/product-price forms previously
  sent whatever the operator typed as raw minor units — typing "50"
  meaninging "50 EGP" would have silently created a 50-piaster (0.50
  EGP) price/bundle.
- Admin nav now hides Staff/Audit-log for non-`OWNER_ADMIN` roles
  (the backend already enforces this at the API level — this just
  avoids a dead end in the UI for roles that can't use them).

### Known backend config issue: media URLs are `localhost`-relative

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
| Shipping (admin) | zones/rates CRUD | ✅ `/admin/shipping` — list zones+rates, create a zone, create a rate under a zone. Live-verified (real "Egypt" zone with 3 real/demo rates found). Editing/deactivating existing zones/rates is **not** built. |
| Promotions: coupons (admin) | create/list/get/update | ✅ `/admin/coupons` — list, create, toggle active. Live-verified (found the real `WELCOME10` coupon already on the backend). `minSpend`/`startsAt`/`expiresAt`/`usageLimit` fields exist in the API but have no form inputs yet — only code/type/value at creation. |
| Promotions: bundles (admin) | full CRUD | ✅ `/admin/bundles` — list, create (name/fixedTotal/eligible variant ids), toggle enabled, delete. Live-verified end-to-end (created and deleted a real test bundle). Currency is hardcoded to EGP in the create form; per-variant surcharge and `requireDifferentPhoneModels`/`isRepeatable` toggles aren't exposed. |
| Auth & staff | login/refresh/logout/me | ✅ login + **automatic token refresh** (refreshes at 80% of the access token's lifetime using `POST /auth/refresh`; falls back to requiring re-login if the refresh token itself is invalid/expired). `logout`/`me` endpoints still unused (logout is handled client-side by discarding the stored session, which is sufficient since these are stateless JWTs). |
| Staff management (admin) | create/list/get/update staff | ✅ `/admin/staff` (OWNER_ADMIN only) — list, create, toggle active. Live-verified (found the real seeded catalog-manager/order-operator accounts). Role change after creation and self-deactivation are blocked; `PATCH` full field edit beyond active/role isn't built. |
| Admin orders | list/detail/fulfillment/payment/receipt-reject/flag-late-payment/sweep-expired | ✅ all except `sweep-expired` (an operational/cron-style action, not a natural UI button) |
| Refunds & returns (admin) | create/list refunds; create/list item returns | ✅ built into `/admin/orders/[id]` (OWNER_ADMIN only, shown only when payment status is PAID/PARTIALLY_REFUNDED) — issue a refund, record a per-line item return. Live-verified against a real order (**note:** this created one real, permanent refund and return record on the backend for verification — there is no delete/undo endpoint for either, both clearly reason-tagged "FE verification test"). |
| Admin catalog: products | create/list/get/update/status/attach-collection | ✅ create, list, detail, status update, and now **full field editing** (name/description/base price) via `/admin/products/[id]`. `attach-collection` is **not** built. |
| Admin catalog: variants | create/update | ✅ create (with real phone-model/case-type dropdowns, sourced from the live public catalog) + active/inactive toggle. Price/compareAtPrice/SKU editing after creation is **not** built. |
| Admin catalog: media | upload/attach/detach (product), attach/detach (variant), list, delete | ✅ upload+attach+detach for **products**, live-verified (see the `localhost` URL warning at the top of this file). Variant-level media (`/admin/media/variants/...`), the standalone media library list/delete, and reordering/re-choosing primary are **not** built. |
| Inventory: stock items | adjust, movements, reservations | ⚠️ adjust only (`/admin/stock`, needs a stock-item id typed in manually — no browser to look one up) |
| Inventory: reservations (admin) | sweep-expired | ❌ not built (operational action) |
| Content: homepage sections (admin + public) | full CRUD + public read | ⚠️ `/admin/homepage-sections` — list, create, toggle enabled, live-verified (found the real demo `BANNER` section). **The storefront homepage still does not read from this** — it's hand-built to match the approved design reference per the original brief. Sections created here have no visible effect yet; wiring the homepage to consume them is future work. |
| Content: pages (admin + public) | full CRUD + public read | ✅ `/admin/pages` — list, create (as draft), publish/unpublish toggle. Public `/pages/[slug]` reads published ones. Live-verified: found a real draft "Shipping Policy" page already on the backend (explaining why the earlier public `GET /pages` check returned `[]` — that endpoint only shows PUBLISHED pages, correctly). Editing an existing page's body/title after creation isn't built. Footer links (About/Help/Privacy/Terms) still aren't pointed at real slugs — do that once real content is published and final slugs are chosen. |
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

See Milestone 8 below — everything listed here landed. The `localhost`
media-URL issue flagged at the top of this file is still open and
needs a backend-side fix.

---

## UI/UX enhancement pass (between milestones 7 and 8)

- **Fixed a real bug**: the admin sidebar was `hidden` below the `sm:`
  breakpoint with no alternative — the admin panel was completely
  unnavigable on a phone. Added a mobile top bar + slide-down nav.
- Active-route highlighting in the admin nav (desktop + mobile).
- New `StatusBadge` component (color-coded by status: green=good,
  amber=in-progress, red=problem, gray=neutral) covering fulfillment,
  payment, receipt, and product statuses — applied across admin
  orders/products and the customer-facing order tracking page.
- Added `focus-visible` outlines to every admin input/select/button/
  link that was missing them (previously only the login and
  new-product pages had this).
- Hover-highlighted, transitioned table rows and toggle buttons across
  admin list pages.

---

## Milestone 8 — remaining admin CRUD, UI polish, SEO, first commit

Delivered in one pass, each piece live-verified against the real
backend with direct API calls before being wired into the UI (and, for
mutations, cleaned up afterward where the backend provides a way to):

### Admin panel — remaining CRUD

- **Bundles** (`/admin/bundles`) — list, create, enable/disable, delete.
- **Refunds & returns** — added into `/admin/orders/[id]` rather than a
  separate page, since both are order-scoped actions.
- **Shipping zones & rates** (`/admin/shipping`) — list existing
  zones/rates, create new ones.
- **Staff management** (`/admin/staff`, OWNER_ADMIN only) — list,
  create, activate/deactivate. Can't deactivate your own account or
  change your own role from the UI (deliberate safety rail, not a bug).
- **Product field editing** — name/description/base price editable
  after creation on `/admin/products/[id]`, not just status.
- **Homepage sections CMS** (`/admin/homepage-sections`) and **Pages
  CMS** (`/admin/pages`, publish/unpublish) — both built and
  live-verified. The homepage-sections one is explicitly labeled in
  its own UI as not yet consumed by the storefront (see coverage
  table) so it isn't mistaken for a working CMS-driven homepage.
- **Admin token auto-refresh** — `AdminAuthProvider` now schedules a
  silent `POST /auth/refresh` at 80% of the access token's lifetime;
  falls back to requiring a real re-login only if the refresh token
  itself has expired.

### Bug caught during this pass

`PATCH /admin/products/:id/status` and `PATCH /admin/products/:id`
responses omit `variants`/`media` — the product detail page originally
replaced its whole local state with that response, which would have
silently wiped the variants table and photos from the screen after
any status change or detail edit. Fixed by merging the response onto
existing state instead of replacing it.

### SEO & branding basics

- `robots.ts` and `sitemap.ts` (Next.js metadata routes) — the sitemap
  pulls real in-stock product slugs live, with a static-routes fallback
  if the backend is unreachable at request time.
- Open Graph / Twitter card metadata and a title template added to the
  root layout; per-page titles simplified to avoid double-appending the
  brand name now that the template does it.
- A generated favicon/apple-touch-icon (`src/app/icon.tsx`,
  `apple-icon.tsx`) using the brand's orange asterisk mark — replaces
  the Next.js default icon. Still a placeholder, not real brand
  artwork (see the "temporary assets" note in Milestone 1).
- New env var `NEXT_PUBLIC_SITE_URL` (see `.env.example`) for the
  public origin used in the above.

### First git commit

The repository had never been committed despite git being initialized
in Milestone 1. Reviewed `git status`/staged diff for secrets before
committing — `.env.local` correctly stays untracked
(`.gitignore` excludes `.env*` except `.env.example`), no
`node_modules`/`.next` staged. One root commit, 90 files.

### Explicitly not done this pass (by design, not oversight)

- **Real product photography / logo** — still no real assets exist;
  per the brief, fabricating "real-looking" images or a logo isn't
  acceptable. All imagery is either original SVG or a clearly-labeled
  temporary crop of `refrenace.png` (see "Visual rebuild" above) — none
  of it is a claim that production photography exists.
- **Arabic translation / RTL** — explicitly out of scope per the
  original brief ("outside this milestone") and re-confirmed out of
  scope for this pass too. Admin CMS forms (pages, shipping zones)
  collect the required `*Ar` fields the backend needs, but no Arabic UI
  or `dir="rtl"` layout exists.
- **Phone brands / models / case types admin CRUD** — not built.
  Live-verified read-only usage (variant creation already sources real
  phone-model/case-type dropdowns from the public catalog), but there's
  no admin screen to create/edit a brand, model, or case type itself —
  that still requires the backend's own tooling.
- **Variant editing after creation** (price/SKU/compareAtPrice) and
  **product↔collection attachment** — still only create + status/active
  toggles, as documented in the coverage audit above.
- **Variant-level media, media reordering, "choose a different
  primary"** — still product-level-only, first-upload-is-primary, as
  documented above.
- **Full bounded 401-retry-on-every-request** — the admin token-refresh
  fix in this pass covers the *scheduled* background refresh (correct
  absolute-expiry timing, deduplication, cross-tab sync). It does not
  yet retrofit every individual admin API call to catch a 401 and retry
  once after an on-demand refresh — that needs routing all admin calls
  through one authenticated-request wrapper instead of each page
  reading `accessToken` from context directly, which is a larger
  refactor than fit in this pass. In practice this only matters if an
  access token expires in the ~20% tail window between page load and
  the next scheduled refresh while a request happens to be in flight.
- Real in-browser click-testing — still no headless-browser tool
  available in this environment. Every change has been verified at the
  API/contract level (curl) and confirmed to render/build correctly,
  and reasoned through against the reference image and the stated
  breakpoints, but not visually inspected in an actual browser. Please
  verify manually, especially the hero/collection/product image crops
  at 1440/768/390px and the checkout/receipt-replacement flows.
