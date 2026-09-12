/**
 * Original, hand-built vector placeholder art for a phone case product
 * shot. Not derived from refrenace.png or any third-party photography —
 * see docs/FRONTEND_PROGRESS.md for the real photography this should be
 * replaced with.
 */

export type CaseArtwork = "check" | "cherry" | "orbit" | "sage";

const KNOWN_ARTWORK: CaseArtwork[] = ["check", "cherry", "orbit", "sage"];

/** Maps a demo product slug to its illustration key, if it has one. */
export function artworkForProductSlug(slug: string): CaseArtwork | null {
  return (KNOWN_ARTWORK as string[]).includes(slug) ? (slug as CaseArtwork) : null;
}

const FILLS: Record<CaseArtwork, string> = {
  check: "url(#pattern-check)",
  cherry: "url(#gradient-cherry)",
  orbit: "url(#gradient-orbit)",
  sage: "url(#gradient-sage)",
};

export function PhoneCaseIllustration({
  artwork,
  className,
}: {
  artwork: CaseArtwork;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 480"
      className={className}
      role="img"
      aria-label={`${artwork} case placeholder artwork`}
    >
      <defs>
        <pattern
          id="pattern-check"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          <rect width="30" height="30" fill="#efe9df" />
          <rect width="15" height="15" fill="#151312" />
          <rect x="15" y="15" width="15" height="15" fill="#151312" />
        </pattern>
        <linearGradient id="gradient-cherry" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c21f1f" />
          <stop offset="100%" stopColor="#7a0f10" />
        </linearGradient>
        <linearGradient id="gradient-orbit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2b2e" />
          <stop offset="100%" stopColor="#0c0c0d" />
        </linearGradient>
        <linearGradient id="gradient-sage" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a9b79a" />
          <stop offset="100%" stopColor="#77876a" />
        </linearGradient>
      </defs>

      <rect
        x="20"
        y="10"
        width="200"
        height="460"
        rx="42"
        fill={FILLS[artwork]}
        stroke="#00000014"
      />

      <rect x="44" y="34" width="86" height="86" rx="22" fill="#00000022" />
      <circle cx="70" cy="60" r="15" fill="#00000055" />
      <circle cx="104" cy="60" r="15" fill="#00000055" />
      <circle cx="70" cy="94" r="15" fill="#00000055" />
      <circle cx="104" cy="94" r="12" fill="#ffffff33" />

      {artwork === "cherry" && (
        <>
          <circle cx="150" cy="300" r="26" fill="#a30c0c" />
          <circle cx="112" cy="330" r="26" fill="#a30c0c" />
          <path
            d="M150 274 L162 220"
            stroke="#3f6b2a"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M112 304 L124 240"
            stroke="#3f6b2a"
            strokeWidth="4"
            fill="none"
          />
        </>
      )}

      {artwork === "orbit" && (
        <>
          <circle cx="150" cy="270" r="34" fill="#e7e7ea" />
          <ellipse
            cx="150"
            cy="270"
            rx="58"
            ry="14"
            fill="none"
            stroke="#e7e7ea"
            strokeWidth="3"
            transform="rotate(-18 150 270)"
          />
          <circle cx="80" cy="180" r="3" fill="#ffffff" />
          <circle cx="60" cy="360" r="2.5" fill="#ffffff" />
          <circle cx="180" cy="150" r="2" fill="#ffffff" />
          <circle cx="190" cy="400" r="3" fill="#ffffff" />
        </>
      )}

      {artwork === "sage" && (
        <>
          <path
            d="M120 180 C150 230 150 300 120 380"
            stroke="#3f5a34"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M120 210 C140 220 152 236 156 254"
            stroke="#3f5a34"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M120 260 C100 270 88 286 84 304"
            stroke="#3f5a34"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M120 310 C142 318 156 334 160 352"
            stroke="#3f5a34"
            strokeWidth="3"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}
