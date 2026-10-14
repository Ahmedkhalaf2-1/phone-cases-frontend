import { ApiError } from "@/lib/api/http";
import type { MessageKey, Translator } from "./translate";

/**
 * Customer-facing text for a failed API call.
 *
 * Backend messages are English. In English they are shown as-is (they are
 * often specific and useful); in other languages only network failures
 * are mapped, and everything else falls back to a localized message so
 * English never leaks into the Arabic UI. API contracts are untouched.
 */
export function apiErrorMessage(
  error: unknown,
  { t, locale }: Pick<Translator, "t" | "locale">,
  fallbackKey: MessageKey,
): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") return t("common.networkError");
    if (locale === "en" && error.message) return error.message;
  }
  return t(fallbackKey);
}
