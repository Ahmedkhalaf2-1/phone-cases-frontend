import type { Locale } from "../config";
import { ar } from "./ar";
import { en } from "./en";

export type { Messages } from "./en";

export function getMessages(locale: Locale) {
  return locale === "ar" ? ar : en;
}
