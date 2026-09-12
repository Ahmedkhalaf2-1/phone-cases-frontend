/**
 * Original vector placeholder background for a "Pick your mood" collection
 * tile. Not derived from refrenace.png. Real editorial photography should
 * replace this per collection — see docs/FRONTEND_PROGRESS.md.
 */

export type MoodArtwork = "different" | "calm" | "bold";

export function MoodTileArt({
  artwork,
  className,
}: {
  artwork: MoodArtwork;
  className?: string;
}) {
  if (artwork === "different") {
    return (
      <svg
        viewBox="0 0 400 500"
        className={className}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Different mood placeholder artwork"
      >
        <rect width="400" height="500" fill="#efece4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <path
            key={i}
            d={`M ${20 + i * 60} 0 L ${80 + i * 60} 500`}
            stroke="#141210"
            strokeWidth="26"
            fill="none"
          />
        ))}
        <circle cx="300" cy="120" r="70" fill="#141210" />
      </svg>
    );
  }

  if (artwork === "calm") {
    return (
      <svg
        viewBox="0 0 400 500"
        className={className}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Calm mood placeholder artwork"
      >
        <rect width="400" height="500" fill="#7c8a6c" />
        <path
          d="M120 60 C220 160 220 340 120 460"
          stroke="#4b5a3c"
          strokeWidth="10"
          fill="none"
        />
        <path
          d="M120 140 C170 155 205 185 220 220"
          stroke="#4b5a3c"
          strokeWidth="8"
          fill="none"
        />
        <path
          d="M120 240 C80 255 55 280 45 310"
          stroke="#4b5a3c"
          strokeWidth="8"
          fill="none"
        />
        <path
          d="M120 340 C165 355 195 385 210 415"
          stroke="#4b5a3c"
          strokeWidth="8"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 400 500"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Bold mood placeholder artwork"
    >
      <rect width="400" height="500" fill="#ff4d1a" />
      <circle cx="90" cy="100" r="60" fill="#141210" />
      <circle cx="90" cy="100" r="20" fill="#efece4" />
      <path
        d="M220 340 q30 -50 60 0 q30 50 60 0"
        stroke="#141210"
        strokeWidth="10"
        fill="none"
      />
      <circle cx="250" cy="330" r="6" fill="#141210" />
      <circle cx="300" cy="330" r="6" fill="#141210" />
      <text
        x="150"
        y="450"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="34"
        fill="#efece4"
      >
        GOOD MOOD
      </text>
    </svg>
  );
}
