import Link from "next/link";
import type { PublicProductSummary } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";
import type { MoodCollection } from "@/lib/demo/collections.demo";

/**
 * Fallback poster image while the video loads or if video is unavailable.
 */
const POSTER_IMAGE = "/temp-reference/hero-collage.webp";

export function Hero({
  collections,
  videoSrc = "/hero-video.mp4",
}: {
  products?: (PublicProductSummary | DemoProduct)[];
  collections: MoodCollection[];
  videoSrc?: string;
}) {
  return (
    <section className="w-full pb-8">
      {/* 1. Full-Width 16:9 Video Banner (Edge to Edge) */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 shadow-md">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={POSTER_IMAGE}
          className="h-full w-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>

      {/* 2. Clean Search & Collections below the video */}
      <div className="mx-auto mt-8 flex max-w-[1200px] flex-col items-center px-4 text-center sm:px-6 lg:px-8 animate-rise-in">
        <p className="mb-4 text-xs font-semibold tracking-widest uppercase text-muted-foreground">
          A design you choose. A style you own.
        </p>

        {/* Clean Search Bar */}
        <form
          action="/phone-cases"
          method="GET"
          role="search"
          className="flex w-full max-w-md items-center gap-1 rounded-pill border border-border bg-surface p-1.5 pl-5 shadow-soft transition-all focus-within:border-accent focus-within:bg-white focus-within:shadow-md"
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
            className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent text-white shadow-accent transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

        {/* Collections Tags - Clean layout */}
        {collections.length > 0 && (
          <nav
            aria-label="Shop by mood"
            className="mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2"
          >
            {collections.slice(0, 10).map((collection) => (
              <Link
                key={collection.id}
                href={`/phone-cases?collection=${collection.slug}`}
                className="rounded-pill border border-border bg-surface px-4 py-2 text-xs font-medium tracking-tight text-ink shadow-soft transition-colors hover:border-accent hover:text-accent sm:text-sm"
              >
                {collection.name}
              </Link>
            ))}
            <Link
              href="/phone-cases"
              className="rounded-pill bg-ink px-4 py-2 text-xs font-medium tracking-tight text-white shadow-soft transition-colors hover:bg-accent sm:text-sm"
            >
              Shop all ({collections.length}) →
            </Link>
          </nav>
        )}
      </div>
    </section>
  );
}
