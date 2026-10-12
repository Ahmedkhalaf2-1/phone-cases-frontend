"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  SearchCollectionHit,
  SearchProductHit,
  SearchResponse,
} from "@/lib/search-types";

/** How long each collection stays in the spotlight before rotating. */
const SPOTLIGHT_MS = 4500;
/** How long the placeholder shows each suggestion. */
const PLACEHOLDER_MS = 2600;
const DEBOUNCE_MS = 200;

// Shared across header instances (desktop + mobile) and re-opens.
let collectionsPromise: Promise<SearchCollectionHit[]> | null = null;
const spotlightCache = new Map<string, Promise<SearchProductHit[]>>();

function fetchSearch(query: string, signal?: AbortSignal) {
  return fetch(`/api/search?${query}`, { signal }).then((res) => {
    if (!res.ok) throw new Error(`search ${res.status}`);
    return res.json() as Promise<SearchResponse>;
  });
}

function loadCollections() {
  collectionsPromise ??= fetchSearch("")
    .then((data) => data.collections)
    .catch(() => {
      collectionsPromise = null; // let the next open retry
      return [];
    });
  return collectionsPromise;
}

function loadSpotlight(slug: string) {
  let entry = spotlightCache.get(slug);
  if (!entry) {
    entry = fetchSearch(`collection=${encodeURIComponent(slug)}`)
      .then((data) => data.products)
      .catch(() => {
        spotlightCache.delete(slug);
        return [];
      });
    spotlightCache.set(slug, entry);
  }
  return entry;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * The header search: a glowing pill input that opens a suggestions panel.
 * Empty, the panel spotlights a rotating collection ("Searching for
 * Anime? Here are some of our best"); typing filters collections (with
 * their covers) and matching cases. Enter goes to the full /search page.
 */
export function HeaderSearch({
  variant = "inline",
  autoFocus = false,
  onNavigate,
}: {
  /** "inline" floats the panel under the bar; "sheet" stacks it (mobile). */
  variant?: "inline" | "sheet";
  autoFocus?: boolean;
  /** Called after the visitor follows a result (e.g. to close a mobile sheet). */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const [isOpen, setIsOpen] = useState(variant === "sheet");
  const [query, setQuery] = useState("");
  const [collections, setCollections] = useState<SearchCollectionHit[]>([]);
  // Results remember which query they answer, so stale ones can stay on
  // screen (dimmed) while the next request is in flight.
  const [results, setResults] = useState<
    (SearchResponse & { query: string }) | null
  >(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const trimmed = query.trim();
  const isLoading = trimmed !== "" && results?.query !== trimmed;

  // Collections load on first open (cached module-wide after that).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    loadCollections().then((list) => {
      if (!cancelled) setCollections(list);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Debounced live results while typing; stale requests are aborted.
  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSearch(`q=${encodeURIComponent(trimmed)}`, controller.signal)
        .then((data) => setResults({ ...data, query: trimmed }))
        .catch((error: unknown) => {
          if ((error as Error).name === "AbortError") return;
          setResults({ collections: [], products: [], query: trimmed });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Close the floating panel on outside click / Escape.
  useEffect(() => {
    if (!isOpen || variant === "sheet") return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, variant]);

  // "/" focuses the search from anywhere (unless already typing somewhere).
  useEffect(() => {
    if (variant !== "inline") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  // Cycle the placeholder through collection names.
  const placeholderNames = useMemo(
    () => collections.map((c) => c.name),
    [collections],
  );
  useEffect(() => {
    if (reducedMotion || placeholderNames.length < 2 || query) return;
    const timer = setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % placeholderNames.length),
      PLACEHOLDER_MS,
    );
    return () => clearInterval(timer);
  }, [reducedMotion, placeholderNames.length, query]);

  const placeholder =
    placeholderNames.length > 0
      ? `Search “${placeholderNames[placeholderIndex % placeholderNames.length]}”…`
      : "What are you shopping for today?";

  function close() {
    setIsOpen(false);
    onNavigate?.();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    close();
    inputRef.current?.blur();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/collections");
  }

  const panel = (
    <div
      id={panelId}
      className={
        variant === "inline"
          ? "absolute left-0 top-full z-50 mt-2 w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-border bg-surface shadow-lifted animate-search-pop"
          : "mt-3 overflow-hidden rounded-[24px] border border-border bg-surface shadow-soft"
      }
    >
      <div className="max-h-[min(70vh,560px)] overflow-y-auto overscroll-contain p-3 sm:p-4">
        {trimmed ? (
          <QueryResults
            query={trimmed}
            results={results}
            isLoading={isLoading}
            fallbackCollections={collections}
            onNavigate={close}
          />
        ) : (
          <Spotlight
            collections={collections}
            reducedMotion={reducedMotion}
            onNavigate={close}
          />
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        role="search"
        onSubmit={submit}
        className={`group/search relative flex w-full items-center gap-2 rounded-pill border p-1 pl-4 transition-all duration-300 ${
          isOpen
            ? "border-accent/40 bg-white shadow-[0_0_0_4px_rgb(84_51_235_/_0.12),0_8px_30px_-8px_rgb(84_51_235_/_0.35)]"
            : "border-border bg-background hover:border-cool-stone hover:bg-white"
        }`}
      >
        <SearchGlyph
          className={`shrink-0 transition-colors ${isOpen ? "text-accent" : "text-muted-foreground"}`}
        />
        <label htmlFor={inputId} className="sr-only">
          Search phone cases and collections
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-controls={isOpen ? panelId : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-pill text-muted-foreground transition-colors hover:bg-background hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          variant === "inline" &&
          !isOpen && (
            <kbd className="hidden shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground lg:inline">
              /
            </kbd>
          )
        )}
        <button
          type="submit"
          aria-label="Search"
          className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-accent text-white shadow-accent transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>

      {isOpen && panel}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state: rotating collection spotlight + all-collection chips.  */
/* ------------------------------------------------------------------ */

function Spotlight({
  collections,
  reducedMotion,
  onNavigate,
}: {
  collections: SearchCollectionHit[];
  reducedMotion: boolean;
  onNavigate: () => void;
}) {
  // Prefer collections with a cover; fall back to all of them.
  const featured = useMemo(() => {
    const withCover = collections.filter((c) => c.cover);
    return withCover.length > 0 ? withCover : collections;
  }, [collections]);

  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [products, setProducts] = useState<Record<string, SearchProductHit[]>>({});

  const current = featured.length > 0 ? featured[index % featured.length] : undefined;

  useEffect(() => {
    if (reducedMotion || isPaused || featured.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % featured.length), SPOTLIGHT_MS);
    return () => clearInterval(timer);
  }, [reducedMotion, isPaused, featured.length]);

  // Load the current spotlight's cases, and prefetch the next one.
  useEffect(() => {
    if (featured.length === 0) return;
    let cancelled = false;
    const slugs = [index, index + 1].map((i) => featured[i % featured.length].slug);
    for (const slug of slugs) {
      loadSpotlight(slug).then((items) => {
        if (!cancelled) setProducts((prev) => (prev[slug] ? prev : { ...prev, [slug]: items }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [featured, index]);

  if (!current) {
    return <PanelSkeleton />;
  }

  const items = products[current.slug];

  return (
    <div className="flex flex-col gap-4">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <Link
          key={current.slug}
          href={`/collections/${current.slug}`}
          onClick={onNavigate}
          className="group relative block aspect-[16/7] overflow-hidden rounded-[18px] bg-ink animate-search-fade focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {current.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.cover.src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105 ${
                current.cover.position === "top" ? "object-top" : "object-center"
              }`}
            />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/0" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/70">
                Searching for <span className="text-white">{current.name}</span>?
              </p>
              <p className="font-display text-xl tracking-tighter text-white sm:text-2xl">
                Here are some of our best
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors group-hover:bg-white group-hover:text-ink">
              View all <span aria-hidden>→</span>
            </span>
          </div>
        </Link>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {(items ?? Array.from({ length: 4 }, () => null)).slice(0, 4).map((product, i) =>
            product ? (
              <Link
                key={product.slug}
                href={`/products/${product.slug}`}
                onClick={onNavigate}
                title={product.name}
                className="group/thumb flex aspect-square items-center justify-center overflow-hidden rounded-[14px] border border-border bg-surface animate-search-fade focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {product.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain transition-transform duration-300 group-hover/thumb:scale-110"
                  />
                )}
              </Link>
            ) : (
              <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-background" />
            ),
          )}
        </div>

        {featured.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Spotlight collection">
            {featured.map((c, i) => {
              const active = i === index % featured.length;
              return (
                <button
                  key={c.slug}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={c.name}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-pill transition-all duration-300 ${
                    active ? "w-5 bg-ink" : "w-1.5 bg-cool-stone hover:bg-muted-foreground"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Browse collections</p>
        <div className="flex flex-wrap gap-1.5">
          {collections.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              onClick={onNavigate}
              className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Typing: matching collections (with covers) + matching cases.        */
/* ------------------------------------------------------------------ */

function QueryResults({
  query,
  results,
  isLoading,
  fallbackCollections,
  onNavigate,
}: {
  query: string;
  results: SearchResponse | null;
  isLoading: boolean;
  fallbackCollections: SearchCollectionHit[];
  onNavigate: () => void;
}) {
  if (!results) return <PanelSkeleton />;

  const { collections, products } = results;
  const isEmpty = collections.length === 0 && products.length === 0;

  return (
    <div className={`flex flex-col gap-5 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
      {collections.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Collections</p>
          <div className="grid grid-cols-2 gap-2">
            {collections.slice(0, 4).map((c, i) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                onClick={onNavigate}
                className={`group relative block overflow-hidden rounded-[16px] bg-ink animate-search-fade focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  collections.length === 1 ? "col-span-2 aspect-[16/7]" : "aspect-[16/10]"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.cover.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      c.cover.position === "top" ? "object-top" : "object-center"
                    }`}
                  />
                ) : (
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-accent to-ink" />
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                  <span className="truncate font-display text-lg tracking-tighter text-white">
                    {c.name}
                  </span>
                  <span aria-hidden className="text-white/80 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section>
          <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">Cases</p>
          <ul className="flex flex-col">
            {products.map((p, i) => (
              <li key={p.slug} className="animate-search-fade" style={{ animationDelay: `${i * 40}ms` }}>
                <Link
                  href={`/products/${p.slug}`}
                  onClick={onNavigate}
                  className="group flex items-center gap-3 rounded-[14px] p-1.5 transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-border bg-surface">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      <Highlight text={p.name} query={query} />
                    </span>
                    {p.collection && (
                      <span className="block truncate text-xs text-muted-foreground">{p.collection}</span>
                    )}
                  </span>
                  {p.price && <span className="shrink-0 text-sm font-medium text-ink">{p.price}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isEmpty && !isLoading && (
        <div className="px-1 py-4 text-center">
          <p className="text-sm text-ink">
            No matches for “<span className="font-medium">{query}</span>”
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Try one of our collections instead</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {fallbackCollections.slice(0, 8).map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                onClick={onNavigate}
                className="rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isEmpty && (
        <Link
          href={`/search?q=${encodeURIComponent(query)}`}
          onClick={onNavigate}
          className="flex items-center justify-between rounded-[14px] bg-background px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="truncate">See all results for “{query}”</span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-accent-wash/70 px-0.5 text-inherit">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <div className="aspect-[16/7] animate-pulse rounded-[18px] bg-background" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-background" />
        ))}
      </div>
    </div>
  );
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
