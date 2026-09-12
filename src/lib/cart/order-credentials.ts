/**
 * Maps a guest order's tracking token to the cart token that created it.
 *
 * Needed because `POST /cart/receipts/replace` (used to resubmit a
 * rejected InstaPay receipt) is guarded by `X-Cart-Token` for the
 * *original* cart — not the new cart `CartProvider` starts right after
 * checkout. Without this, a customer returning to their tracking link
 * after a rejection would have no way to replace the receipt at all.
 *
 * Stored in localStorage (survives closing the tab — a rejection can
 * arrive up to the 24h InstaPay review deadline) under a key scoped to
 * the tracking token, never in the URL/query string and never sent to
 * analytics or logs. This is an opaque bearer-style credential, not
 * personal data.
 */

const PREFIX = "order-cart-credential:";

export function saveOrderCartCredential(trackingToken: string, cartToken: string) {
  try {
    window.localStorage.setItem(`${PREFIX}${trackingToken}`, cartToken);
  } catch {
    // Storage unavailable — replacement will show an honest limitation
    // instead of pretending to work.
  }
}

export function getOrderCartCredential(trackingToken: string): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${trackingToken}`);
  } catch {
    return null;
  }
}
