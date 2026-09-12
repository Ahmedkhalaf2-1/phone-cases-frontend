import Link from "next/link";
import { PhoneCaseIllustration } from "@/components/graphics/PhoneCaseIllustration";

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="animate-rise-in">
          <h1 className="font-display text-6xl leading-[0.92] tracking-tight text-ink uppercase sm:text-7xl lg:text-8xl">
            Your case.
            <br />
            Your mood.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            A design you choose. A style you own.
          </p>
          <Link
            href="#collections"
            className="group mt-8 inline-flex items-center gap-4 rounded-sm bg-ink py-4 ps-6 pe-4 text-sm font-semibold tracking-wide text-white uppercase transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

        <div
          className="relative mx-auto aspect-4/5 w-full max-w-md animate-rise-in [animation-delay:120ms]"
          aria-hidden={false}
        >
          <div className="absolute inset-0 rounded-md bg-accent" />
          <div className="absolute end-[8%] top-[6%] size-40 rounded-full bg-[#ffcbaa]/70 sm:size-48" />
          <SparkleIcon className="absolute end-[-2%] top-[-4%] size-8 text-accent sm:size-10" />

          <div className="absolute start-[10%] top-[6%] w-2/3 max-w-56 -rotate-6">
            <PhoneCaseIllustration
              artwork="check"
              className="w-full drop-shadow-xl"
            />
          </div>
          <div className="absolute end-[6%] bottom-[6%] w-2/5 max-w-40 rotate-6">
            <PhoneCaseIllustration
              artwork="cherry"
              className="w-full drop-shadow-xl"
            />
          </div>

          <p className="absolute start-[6%] top-[6%] max-w-28 border-t-2 border-ink pt-2 text-xs font-semibold tracking-wide text-ink uppercase">
            01 / Collection
          </p>
          <p className="absolute bottom-[4%] start-[6%] max-w-28 text-[11px] font-semibold tracking-wide text-ink/80 uppercase">
            Cases for a brighter you
          </p>
          <p className="absolute end-[4%] bottom-[1%] max-w-24 text-end text-[10px] font-semibold tracking-wide text-ink/80 uppercase">
            Good cases, better days
          </p>

          <div className="absolute end-[2%] top-[56%] max-w-24 rotate-3 rounded-sm border border-border bg-background px-3 py-2 text-center shadow-md">
            <p className="font-display text-sm leading-none tracking-wide text-ink uppercase">
              Pick your mood
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2c.6 3.8 1.9 6.1 4.6 6.8-2.7.7-4 3-4.6 6.8-.6-3.8-1.9-6.1-4.6-6.8 2.7-.7 4-3 4.6-6.8Z" />
      <path d="M19.5 15c.3 1.9.9 3 2.5 3.5-1.6.5-2.2 1.6-2.5 3.5-.3-1.9-.9-3-2.5-3.5 1.6-.5 2.2-1.6 2.5-3.5Z" />
    </svg>
  );
}
