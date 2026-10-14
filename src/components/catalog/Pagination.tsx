import Link from "next/link";
import { getI18n } from "@/i18n/server";

export async function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const { t } = await getI18n();

  return (
    <nav
      aria-label={t("catalog.pagination")}
      className="mt-8 flex items-center justify-center gap-2"
    >
      <PageLink
        href={buildHref(page - 1)}
        disabled={page <= 1}
        label={t("catalog.previousPage")}
      >
        {t("catalog.prev")}
      </PageLink>
      <span className="px-2 text-sm text-muted-foreground">
        {t("catalog.pageOf", { page, total: totalPages })}
      </span>
      <PageLink
        href={buildHref(page + 1)}
        disabled={page >= totalPages}
        label={t("catalog.nextPage")}
      >
        {t("catalog.next")}
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
        className="rounded-pill border border-border px-4 py-1.5 text-sm text-muted-foreground/50"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded-pill border border-border px-4 py-1.5 text-sm text-ink hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
