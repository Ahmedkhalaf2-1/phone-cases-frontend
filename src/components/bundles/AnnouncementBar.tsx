import Link from "next/link";
import { Fragment } from "react";
import type { AnnouncementBanner } from "@/lib/api/types";

// Enough repeats that each half of the track is wider than any viewport, so
// the looping strip never shows a gap.
const REPEATS = 8;

/**
 * Slim top announcement bar. A server component with no client state: the
 * copy and destination come from the backend, the movement is pure CSS
 * (see .sf-announce in globals.css), and reduced-motion users get one
 * static, centered message. Screen readers hear the message once; the
 * repeated marquee copies are aria-hidden.
 */
export function AnnouncementBar({ banner }: { banner: AnnouncementBanner }) {
  const label = `${banner.text} — ${banner.ctaLabel}`;
  const item = (
    <span className="sf-announce-item inline-flex shrink-0 items-center gap-2 px-6">
      <span>{banner.text}</span>
      <span aria-hidden className="opacity-60">
        —
      </span>
      <span className="underline underline-offset-4">{banner.ctaLabel}</span>
    </span>
  );

  return (
    <Link
      href={banner.target.href}
      className="sf-announce sticky top-0 z-40 block h-9 overflow-hidden bg-ink text-xs font-semibold uppercase leading-9 tracking-[0.08em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:h-10 sm:text-[13px] sm:leading-10"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden className="sf-announce-track whitespace-nowrap">
        <span className="sf-announce-group">
          {Array.from({ length: REPEATS }, (_, i) => (
            <Fragment key={i}>{item}</Fragment>
          ))}
        </span>
        <span className="sf-announce-group" data-dup>
          {Array.from({ length: REPEATS }, (_, i) => (
            <Fragment key={i}>{item}</Fragment>
          ))}
        </span>
      </span>
    </Link>
  );
}
