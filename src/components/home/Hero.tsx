import Link from "next/link";
import { SITE } from "@/config/site";
import type { PublicProductSummary } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";
import type { MoodCollection } from "@/lib/demo/collections.demo";

/**
 * TEMPORARY ASSET — used only for products with no real photography yet
 * (see FeaturedProducts/ProductCard for the same fallback pattern). Not
 * a claim that a separate production asset exists.
 */
const FALLBACK_IMAGE = "/temp-reference/hero-collage.webp";

/**
 * Floating, slightly overlapping "constellation" of product cards above
 * the centered wordmark + search, matching the DESIGN.md hero reference.
 * Rotation/offset per card is fixed (not randomized) so server and
 * client render identically.
 */
const CARD_LAYOUT = [
  { rotate: -6, translateY: 8, size: "w-20 sm:w-32 md:w-40" },
  { rotate: 4, translateY: -10, size: "w-24 sm:w-40 md:w-52" },
  { rotate: -3, translateY: 14, size: "w-16 sm:w-28 md:w-36" },
];

export function Hero({
  products,
  collections,
}: {
  products: (PublicProductSummary | DemoProduct)[];
  collections: MoodCollection[];
}) {
  const cards = CARD_LAYOUT.map((layout, index) => ({
    ...layout,
    product: products[index],
  })).filter((c) => c.product);

  return (
    <section className="mx-auto max-w-[1200px] overflow-x-hidden px-4 pt-10 pb-6 sm:px-6 sm:pt-16 lg:px-8">
      {cards.length > 0 && (
        <div className="mb-6 flex animate-rise-in items-end justify-center gap-2 sm:mb-10 sm:gap-4 md:gap-6">
          {cards.map(({ product, rotate, translateY, size }, index) => (
            <Link
              key={product!.id}
              href={`/products/${product!.slug}`}
              style={{
                transform: `rotate(${rotate}deg) translateY(${translateY}px)`,
              }}
              className={`${size} shrink-0 overflow-hidden rounded-card bg-surface shadow-card transition-transform duration-300 ease-out hover:-translate-y-1 hover:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                index === 1 ? "z-10" : "z-0"
              }`}
            >
              <div className="aspect-square overflow-hidden rounded-card-inner m-2 bg-surface">
                {product!.primaryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product!.primaryImage.url}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={FALLBACK_IMAGE}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="animate-rise-in text-center [animation-delay:80ms]">
        <h1 className="font-display text-[clamp(2.75rem,10vw,5.5rem)] leading-[0.95] tracking-tighter text-ink">
          {SITE.brandName.toLowerCase()}
          <span aria-hidden className="text-accent">
            .
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground sm:text-lg">
          A design you choose. A style you own.
        </p>

        <form
          action="/phone-cases"
          method="GET"
          role="search"
          className="mx-auto mt-6 flex max-w-lg items-center gap-1 rounded-pill border border-border bg-surface p-1 pl-5 shadow-soft"
        >
          <label htmlFor="hero-search" className="sr-only">
            What are you shopping for today?
          </label>
          <input
            id="hero-search"
            name="q"
            type="search"
            placeholder="What are you shopping for today?"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-accent text-white shadow-accent transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h13M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

        {collections.length > 0 && (
          <nav
            aria-label="Shop by mood"
            className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2"
          >
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/phone-cases?collection=${collection.slug}`}
                className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium tracking-tight text-ink shadow-soft transition-colors hover:border-accent hover:text-accent"
              >
                {collection.name}
              </Link>
            ))}
            <Link
              href="/phone-cases"
              className="rounded-pill bg-ink px-4 py-2 text-sm font-medium tracking-tight text-white shadow-soft transition-colors hover:bg-accent"
            >
              Shop all →
            </Link>
          </nav>
        )}
      </div>
    </section>
  );
}
