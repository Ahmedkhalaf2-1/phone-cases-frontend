import type { PublicVariant } from "@/lib/api/types";

/** Short "compatible with" label derived from a product's variants. */
export function getCompatibilityLabel(variants: PublicVariant[]): string {
  const names = Array.from(
    new Set(
      variants
        .filter((variant) => variant.phoneModel)
        .map((variant) => variant.phoneModel!.name),
    ),
  );

  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
}
