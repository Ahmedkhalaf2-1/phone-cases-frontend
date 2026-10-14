"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Minimal EN/AR toggle. It only stores the preference in a cookie and asks
 * Next to re-render the current route (router.refresh), so the cart, selected
 * variants, customization state and the URL are all left exactly as they are.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const next: Locale = locale === "ar" ? "en" : "ar";

  function switchLanguage() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      disabled={isPending}
      lang={next}
      aria-label={t("common.languageSwitch")}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-2.5 text-xs font-semibold tracking-wide text-ink transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${className}`}
    >
      {t("common.languageShort")}
    </button>
  );
}
