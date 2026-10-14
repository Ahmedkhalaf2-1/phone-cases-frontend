import { DIRECTION, INTL_LOCALE, type Direction, type Locale } from "./config";
import type { Messages } from "./messages";
import type { PluralForms, PluralPaths, StringPaths } from "./types";

export type MessageKey = StringPaths<Messages>;
export type PluralKey = PluralPaths<Messages>;
export type Params = Record<string, string | number>;

function lookup(messages: unknown, path: string): unknown {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export interface Translator {
  locale: Locale;
  dir: Direction;
  /** Locale tag for Intl APIs (Latin digits). */
  intl: string;
  t: (key: MessageKey, params?: Params) => string;
  /** Plural-aware: `count` selects the form via Intl.PluralRules; `{count}` is available in the text. */
  tn: (key: PluralKey, count: number, params?: Params) => string;
  /** True when `key` exists as a string (for optional, data-driven lookups). */
  has: (key: string) => boolean;
  /** Looks up a dynamic key (e.g. an enum value); falls back to `fallback` when absent. */
  tDynamic: (key: string, fallback: string) => string;
}

export function createTranslator(locale: Locale, messages: Messages): Translator {
  const rules = new Intl.PluralRules(locale);
  return {
    locale,
    dir: DIRECTION[locale],
    intl: INTL_LOCALE[locale],
    t(key, params) {
      const value = lookup(messages, key);
      return typeof value === "string" ? interpolate(value, params) : key;
    },
    tn(key, count, params) {
      const value = lookup(messages, key) as PluralForms | undefined;
      if (!value || typeof value !== "object") return key;
      const form = rules.select(count) as keyof PluralForms;
      const text = value[form] ?? value.other;
      return interpolate(text, { count, ...params });
    },
    has(key) {
      return typeof lookup(messages, key) === "string";
    },
    tDynamic(key, fallback) {
      const value = lookup(messages, key);
      return typeof value === "string" ? value : fallback;
    },
  };
}
