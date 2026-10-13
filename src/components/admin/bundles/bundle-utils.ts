import { useEffect, useState } from "react";
import type { AdminBundle, BundleScope, BundleVariantInfo } from "@/lib/admin/types";

export const inputClass =
  "rounded-pill border border-border bg-background px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const primaryButtonClass =
  "rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const secondaryButtonClass =
  "rounded-pill border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors enabled:hover:border-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const linkButtonClass =
  "text-sm font-semibold text-ink underline underline-offset-4 enabled:hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

interface RemoteState<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * Loads data keyed by `key`; re-runs when the key changes and reports
 * `loading` while the stored result belongs to an older key, so a fast
 * typist never sees stale rows presented as current.
 */
export function useRemote<T>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<RemoteState<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ key, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            key,
            error: err instanceof Error ? err.message : "Could not load data.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // The key fully describes the request; the fetcher closure is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state && state.key === key ? state : null;
  return { data: current?.data, error: current?.error, loading: current === null };
}

/** Debounces a fast-changing value (search boxes) so we don't query per keystroke. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
