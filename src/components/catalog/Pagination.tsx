import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-center gap-2"
    >
      <PageLink
        href={buildHref(page - 1)}
        disabled={page <= 1}
        label="Previous page"
      >
        ← Prev
      </PageLink>
      <span className="px-2 text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <PageLink
        href={buildHref(page + 1)}
        disabled={page >= totalPages}
        label="Next page"
      >
        Next →
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled
        aria-label={label}
        className="rounded-sm border border-border px-3 py-1.5 text-sm text-muted-foreground/50"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded-sm border border-border px-3 py-1.5 text-sm text-ink hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
