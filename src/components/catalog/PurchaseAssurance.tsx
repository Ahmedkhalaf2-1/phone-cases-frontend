"use client";

import { useSyncExternalStore } from "react";

/** Earliest / latest arrival, in calendar days from the customer's today. */
const MIN_DAYS = 1;
const MAX_DAYS = 5;

/** "Sat, 18 Oct" in the browser's calendar day. */
function formatDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("weekday")}, ${pick("day")} ${pick("month")}`;
}

/** "Sat, 18 Oct – Wed, 22 Oct", from `now` + 1 and + 5 days. */
export function deliveryRange(now: Date = new Date()): string {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MIN_DAYS);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_DAYS);
  return `${formatDay(from)} – ${formatDay(to)}`;
}

const subscribeNever = () => () => {};

const ICON = {
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  print: "M7 3h10v5H7zM7 14h10v7H7zM5 8h14a2 2 0 0 1 2 2v5h-4M7 15H3v-5a2 2 0 0 1 2-2",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4",
} as const;

const ITEMS = [
  {
    icon: ICON.truck,
    title: "Fast delivery",
    text: "At your door in 3–5 business days.",
  },
  {
    icon: ICON.print,
    title: "Premium print",
    text: "Crisp colour on a clear-sided case.",
  },
  {
    icon: ICON.shield,
    title: "Lifetime print warranty",
    text: "Covered against peeling and fading.",
  },
];

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
  // null on the server and during hydration, the real range afterwards.
  const range = useSyncExternalStore(
    subscribeNever,
    () => deliveryRange(),
    () => null,
  );

  return (
    <section
      aria-label="Delivery and quality"
      className={`sf-assure rounded-card border border-border bg-surface/70 p-4 max-sm:p-3.5 ${className}`}
    >
      <p
        className="sf-assure-item flex flex-wrap items-baseline gap-x-2 text-sm"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <span className="font-semibold text-ink">Estimated delivery</span>
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
              className="mt-0.5 size-[18px] shrink-0 text-ink/70"
            >
              <path d={item.icon} />
            </svg>
            <p className="text-sm leading-5">
              <span className="block font-semibold text-ink">{item.title}</span>
              <span className="block text-muted-foreground">{item.text}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
