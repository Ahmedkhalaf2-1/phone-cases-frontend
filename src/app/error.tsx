"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl tracking-tighter text-ink">
          Something went wrong
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
