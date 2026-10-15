"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { ProductCard, type ProductCardLayout } from "@/components/catalog/ProductCard";
import { Spinner } from "@/components/ui/Spinner";
import type { ProductListResult } from "@/lib/data/products";

type ViewMode = "grid" | "large" | "list";
const VIEW_KEY = "catalog-view";
const VIEWS: ViewMode[] = ["list", "grid", "large"];

const GRID_CLASS: Record<ViewMode, string> = {
  grid: "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4",
  large: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
  list: "flex flex-col gap-3",
};

// The chosen view lives in localStorage; useSyncExternalStore keeps SSR and
// hydration on the default and swaps in the saved choice afterwards.
const viewListeners = new Set<() => void>();
function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}
function readView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return VIEWS.find((v) => v === stored) ?? "grid";
  } catch {
    return "grid";
  }
}
function writeView(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  viewListeners.forEach((l) => l());
}

function ViewIcon({ mode }: { mode: ViewMode }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" {...common}>
      {mode === "list" && <path d="M4 6h16M4 12h16M4 18h16" />}
      {mode === "grid" && <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />}
      {mode === "large" && <path d="M4 4h16v7H4zM4 14h16v6H4z" />}
    </svg>
  );
}

/**
 * Product grid with infinite scroll: the first page is rendered by the
 * server, the rest is fetched from /api/products as the customer nears the
 * bottom (a "Load more" button is always there as a fallback). Also lets the
 * customer pick list / grid / large layout. Remount it (via `key`) when the
 * filters change.
 */
export function InfiniteProductGrid({
  initial,
  query,
  countLabel,
  emptyMessage,
}: {
  initial: ProductListResult;
  /** Active filters (q, collection, phoneModel, caseType, availableOnly, sort). */
  query: Record<string, string | undefined>;
  countLabel: string;
  emptyMessage: string;
}) {
  const { t } = useI18n();
  const view = useSyncExternalStore(subscribeView, readView, () => "grid" as ViewMode);
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.meta.page);
  const [totalPages, setTotalPages] = useState(initial.meta.totalPages);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMore = page < totalPages;

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setStatus("loading");
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value && key !== "page") params.set(key, value);
      }
      params.set("page", String(page + 1));
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error("bad response");
      const next = (await response.json()) as ProductListResult;
      setItems((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...next.items.filter((p) => !seen.has(p.id))];
      });
      setPage(next.meta.page);
      setTotalPages(next.meta.totalPages);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, [page, query]);

  // Load the next page when the sentinel scrolls near the viewport.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || status === "error") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, status, loadMore, items.length]);

  const layout: ProductCardLayout = view === "list" ? "list" : "grid";

  return (
    <>
      <div className="my-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        <div role="group" aria-label={t("catalog.viewLabel")} className="flex items-center gap-1 rounded-pill bg-surface p-1">
          {VIEWS.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              aria-label={t(`catalog.view.${mode}`)}
              title={t(`catalog.view.${mode}`)}
              onClick={() => writeView(mode)}
              className={`inline-flex size-9 items-center justify-center rounded-pill transition-colors ${
                view === mode ? "bg-ink text-white" : "text-ink hover:bg-background"
              }`}
            >
              <ViewIcon mode={mode} />
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className={GRID_CLASS[view]}>
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              source={initial.source}
              layout={layout}
              imageLoading={index < 4 ? "eager" : "lazy"}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={status === "loading"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {status === "loading" && <Spinner />}
            {status === "loading" ? t("catalog.loadingMore") : t("catalog.loadMore")}
          </button>
          {status === "error" && (
            <p className="text-sm text-accent">{t("catalog.loadError")}</p>
          )}
        </div>
      )}
    </>
  );
}
