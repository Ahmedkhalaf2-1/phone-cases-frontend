import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator, type Translator } from "./translate";

/** The customer's locale for this request (cookie), defaulting to English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Translator for server components / metadata. */
export const getI18n = cache(async (): Promise<Translator> => {
  const locale = await getLocale();
  return createTranslator(locale, getMessages(locale));
});
