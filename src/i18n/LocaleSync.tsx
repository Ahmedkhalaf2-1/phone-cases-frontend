"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";
import { useI18n } from "./I18nProvider";

function cookieLocale() {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.split("=")[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The root layout is rendered once per full page load and kept across
 * client-side navigations, so moving between the storefront and /admin
 * would otherwise keep the previous area's language/direction. This asks
 * Next to re-render the layout when the locale it was rendered with no
 * longer matches the area being shown (admin = English, storefront =
 * the customer's cookie). It never touches cart or page state.
 */
export function LocaleSync() {
  const { locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    const expected = inAdmin ? DEFAULT_LOCALE : cookieLocale();
    if (expected === locale) {
      attempts.current = 0;
      return;
    }
    // Guard against a refresh loop if the cookie and server ever disagree.
    if (attempts.current >= 2) return;
    attempts.current += 1;
    router.refresh();
  }, [locale, pathname, router]);

  return null;
}
