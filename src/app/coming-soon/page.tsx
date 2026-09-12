import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Not available yet",
};

export default function ComingSoonPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-24 text-center sm:px-6">
        <div className="max-w-md">
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">
            Not available yet
          </h1>
          <p className="mt-4 text-muted-foreground">
            This page is not built in this development milestone. The
            homepage is the only fully implemented page right now.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
