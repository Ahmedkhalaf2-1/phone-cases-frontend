"use client";

import { useCallback } from "react";
import { formatPriceFor } from "./format";
import { useI18n } from "./I18nProvider";

/** Locale-aware price formatter bound to the active language. */
export function useFormatPrice() {
  const { locale } = useI18n();
  return useCallback(
    (minorUnits: number, currency: string) => formatPriceFor(locale, minorUnits, currency),
    [locale],
  );
}
