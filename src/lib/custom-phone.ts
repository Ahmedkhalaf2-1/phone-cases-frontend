import type { PublicVariant } from "@/lib/api/types";

/** Select value for the "my phone isn't listed" option. */
export const OTHER_PHONE = "__other__";

const NOTE_MAX = 500;

/**
 * The cheapest in-stock variant per case type. A phone that isn't listed has
 * no variant of its own, so the order is attached to one of these and the
 * typed brand/model travels in the item note for staff.
 */
export function fallbackVariants(variants: PublicVariant[]): PublicVariant[] {
  const best = new Map<string, PublicVariant>();
  for (const v of variants) {
    if (!v.isAvailable) continue;
    const key = v.caseType?.slug ?? "";
    const current = best.get(key);
    if (!current || v.price < current.price) best.set(key, v);
  }
  return [...best.values()];
}

/** Item note that tells staff which phone the customer actually has. */
export function customPhoneNote(brand: string, model: string, userNote: string): string {
  const head = `Phone not listed - Brand: ${brand.trim()}, Model: ${model.trim()}`;
  const extra = userNote.trim();
  return (extra ? `${head} | ${extra}` : head).slice(0, NOTE_MAX);
}
