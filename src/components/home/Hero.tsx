import Link from "next/link";

/**
 * TEMPORARY ASSET — `public/temp-reference/hero-collage.webp` is a
 * cropped, isolated slice of `refrenace.png` (the orange backdrop +
 * peach circle + sparkle + both product cases + their baked-in
 * micro-captions/sticker), used only because no real product
 * photography exists yet. It is a design-development placeholder, not
 * a claim that separate production assets exist — see
 * docs/FRONTEND_PROGRESS.md for what should replace it (real photos of
 * the actual first catalog products, shot in this same composition).
 * The page's actual headline, supporting copy, and CTA below are real
 * text/components, not part of this image.
 */
const HERO_IMAGE = "/temp-reference/hero-collage.webp";
const HERO_IMAGE_WIDTH = 646;
const HERO_IMAGE_HEIGHT = 460;

export function Hero() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="grid items-center gap-8 lg:grid-cols-[43%_57%] lg:gap-10">
        <div className="animate-rise-in">
          <h1 className="font-display text-[clamp(3.5rem,9vw,7.5rem)] leading-[0.94] tracking-tight text-ink uppercase">
            Your case.
            <br />
            Your mood.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground sm:text-xl">
            A design you choose. A style you own.
          </p>
          <Link
            href="/phone-cases"
            className="group mt-6 inline-flex min-h-13 items-center gap-4 rounded-sm bg-ink py-3.5 ps-6 pe-4 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Shop the collection
            <span
              aria-hidden
              className="flex items-center border-s border-white/30 ps-4 transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        <div className="animate-rise-in [animation-delay:120ms]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            width={HERO_IMAGE_WIDTH}
            height={HERO_IMAGE_HEIGHT}
            alt="Checkerboard-pattern and glossy cherry-print phone cases displayed together"
            className="h-auto w-full rounded-md"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}
