"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { formatDayShort } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";

/** Earliest / latest arrival, in calendar days from the customer's today. */
const MIN_DAYS = 1;
const MAX_DAYS = 5;

/**
 * "Sat, 18 Oct – Wed, 22 Oct" (or the Arabic equivalent), from `now` + 1
 * and + 5 days. Only the presentation is localized; the day arithmetic is
 * the same for every language.
 */
export function deliveryRange(locale: Locale, now: Date = new Date()): string {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MIN_DAYS);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_DAYS);
  return `${formatDayShort(locale, from)} – ${formatDayShort(locale, to)}`;
}

const subscribeNever = () => () => {};

const ICON = {
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  print: "M7 3h10v5H7zM7 14h10v7H7zM5 8h14a2 2 0 0 1 2 2v5h-4M7 15H3v-5a2 2 0 0 1 2-2",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4",
} as const;

const ITEMS = [
  { icon: ICON.truck, title: "product.assurance.fastTitle", text: "product.assurance.fastText" },
  { icon: ICON.print, title: "product.assurance.printTitle", text: "product.assurance.printText" },
  {
    icon: ICON.shield,
    title: "product.assurance.warrantyTitle",
    text: "product.assurance.warrantyText",
  },
] as const;

/**
 * Compact reassurance block under the product title. Static copy plus an
 * estimated-delivery range computed from the visitor's own clock (filled in
 * after mount, never during SSR, so there is no hydration mismatch).
 *
 * Motion is pure CSS (see .sf-assure in globals.css): the four lines are
 * always in the DOM, so the card's height is final from the first paint and
 * the reveal only changes opacity/transform - nothing reflows. Reduced
 * motion shows every line immediately.
 */
export function PurchaseAssurance({ className = "" }: { className?: string }) {
  const { t, locale } = useI18n();
  // null on the server and during hydration, the real range afterwards.
  const range = useSyncExternalStore(
    subscribeNever,
    () => deliveryRange(locale),
    () => null,
  );

  return (
    <section
      aria-label={t("product.assurance.label")}
      className={`sf-assure rounded-card border border-border bg-surface/70 p-4 max-sm:p-3.5 ${className}`}
    >
      <p
        className="sf-assure-item flex flex-wrap items-baseline gap-x-2 text-sm"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <span className="font-semibold text-ink">{t("product.assurance.estimatedDelivery")}</span>
        {/* Reserved width so the line does not shift when the dates arrive. */}
        <span className="inline-block min-h-5 min-w-[11.5rem] text-muted-foreground">
          {range && <span className="sf-fade-in inline-block">{range}</span>}
        </span>
      </p>

      <ul className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3">
        {ITEMS.map((item, index) => (
          <li
            key={item.title}
            className="sf-assure-item flex items-start gap-3"
            style={{ "--i": index + 1 } as React.CSSProperties}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 size-[18px] shrink-0 text-accent"
            >
              <path d={item.icon} />
            </svg>
            <p className="text-sm leading-5">
              <span className="block font-semibold text-ink">{t(item.title)}</span>
              <span className="block text-muted-foreground">{t(item.text)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
