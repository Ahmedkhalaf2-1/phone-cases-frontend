import type { AdminBundle, BundleScope, BundleVariantInfo } from "@/lib/admin/types";

export {
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/admin-styles";

export const SCOPE_OPTIONS: {
  value: BundleScope;
  label: string;
  description: string;
}[] = [
  {
    value: "ALL_PRODUCTS",
    label: "All products",
    description: "Every product, including ones you add later.",
  },
  {
    value: "PRODUCTS",
    label: "Specific products",
    description: "Pick the designs that qualify.",
  },
  {
    value: "COLLECTIONS",
    label: "Collections",
    description: "Everything in the chosen collections.",
  },
  {
    value: "CASE_TYPES",
    label: "Case types",
    description: "e.g. Shock Resistant only.",
  },
  {
    value: "PHONE_BRANDS",
    label: "Phone brands",
    description: "All models of the chosen brands.",
  },
  {
    value: "PHONE_MODELS",
    label: "Phone models",
    description: "Only the chosen phone models.",
  },
  {
    value: "SPECIFIC_VARIANTS",
    label: "Specific variants",
    description: "Hand-pick exact product + phone + case combinations.",
  },
];

const TARGET_NOUN: Record<Exclude<BundleScope, "ALL_PRODUCTS" | "SPECIFIC_VARIANTS">, [string, string]> = {
  PRODUCTS: ["product", "products"],
  COLLECTIONS: ["collection", "collections"],
  CASE_TYPES: ["case type", "case types"],
  PHONE_BRANDS: ["phone brand", "phone brands"],
  PHONE_MODELS: ["phone model", "phone models"],
};

export function describeScope(
  scope: BundleScope,
  count: number,
  names: string[] = [],
): string {
  if (scope === "ALL_PRODUCTS") return "All products";
  if (scope === "SPECIFIC_VARIANTS") {
    return `${count} specific variant${count === 1 ? "" : "s"}`;
  }
  const [singular, plural] = TARGET_NOUN[scope];
  if (count === 0) return `No ${plural} selected`;
  if (names.length > 0 && count <= 2) return names.join(", ");
  return `${count} ${count === 1 ? singular : plural}`;
}

export function bundleScopeLabel(bundle: AdminBundle): string {
  const count =
    bundle.scope === "SPECIFIC_VARIANTS"
      ? bundle.eligibleVariants.length
      : bundle.targets.length;
  return describeScope(
    bundle.scope,
    count,
    bundle.targets.map((target) => target.nameEn),
  );
}

export function variantLabel(info: Pick<BundleVariantInfo, "product" | "phoneModel" | "caseType">) {
  return {
    product: info.product.nameEn,
    phone: info.phoneModel
      ? `${info.phoneModel.brand.nameEn} ${info.phoneModel.nameEn}`
      : null,
    caseType: info.caseType?.nameEn ?? null,
  };
}

export { useDebounced, useRemote } from "@/lib/admin/hooks";
