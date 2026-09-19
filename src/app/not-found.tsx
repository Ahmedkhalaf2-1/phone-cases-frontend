import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-24 text-center sm:px-6">
        <div className="max-w-md">
          <h1 className="font-display text-4xl tracking-tighter text-ink">
            Page not found
          </h1>
          <p className="mt-4 text-muted-foreground">
            We couldn&apos;t find what you were looking for.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
