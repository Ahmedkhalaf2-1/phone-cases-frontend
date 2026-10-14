"use client";

import { useI18n } from "@/i18n/I18nProvider";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl tracking-tighter text-ink">
          {t("pages.error.title")}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("pages.error.body")}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex items-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("pages.error.retry")}
        </button>
      </div>
    </div>
  );
}
