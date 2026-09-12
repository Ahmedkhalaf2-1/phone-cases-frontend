import Link from "next/link";
import { FOOTER_LINKS, SITE } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 border-b border-white/15 pb-10 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-[16vw] leading-[0.85] tracking-tight text-transparent uppercase [-webkit-text-stroke:1.5px_white] sm:text-[9vw] md:text-[6.5vw]">
            {SITE.brandName}
          </h2>

          <div className="flex flex-col gap-6 border-white/15 md:flex-row md:items-center md:gap-8 md:border-s md:ps-8">
            <p className="font-display text-2xl leading-tight uppercase">
              Your style.{" "}
              <span aria-hidden className="text-accent">
                ✳
              </span>
              <br />
              Always with you.
            </p>

            <nav aria-label="Footer" className="grid gap-2 text-sm">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-white/80 underline-offset-4 hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <p className="border-white/15 text-sm font-semibold tracking-wide text-white/60 uppercase md:border-s md:ps-8">
              More than a case.
            </p>
          </div>
        </div>

        <p className="pt-6 text-xs text-white/40">
          © {new Date().getFullYear()} {SITE.brandName}. Development preview —
          not a live store.
        </p>
      </div>
    </footer>
  );
}
