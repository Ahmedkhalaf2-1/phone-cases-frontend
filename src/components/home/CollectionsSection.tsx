import Link from "next/link";
import { MoodTileArt } from "@/components/graphics/MoodTileArt";
import type { MoodCollection } from "@/lib/demo/collections.demo";

export function CollectionsSection({
  collections,
}: {
  collections: MoodCollection[];
}) {
  return (
    <section
      id="collections"
      aria-labelledby="collections-heading"
      className="mx-auto max-w-[1440px] scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2
          id="collections-heading"
          className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl"
        >
          Pick your mood
        </h2>
        <Link
          href="/phone-cases"
          className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:inline-flex"
        >
          View all collections <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {collections.map((collection, index) => (
          <Link
            key={collection.id}
            href={`/phone-cases?collection=${collection.slug}`}
            className={`group relative isolate flex h-60 overflow-hidden rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-80 lg:h-[340px] ${
              index === 2 ? "col-span-2 sm:col-span-2" : "col-span-1"
            }`}
          >
            <MoodTileArt
              artwork={collection.artwork}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
            <div className="relative mt-auto flex flex-col gap-1 p-5 text-white">
              <span className="font-display text-2xl tracking-wide uppercase">
                {collection.name}
              </span>
              <span className="text-sm text-white/85">
                {collection.tagline}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/phone-cases"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:hidden"
      >
        View all collections <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
