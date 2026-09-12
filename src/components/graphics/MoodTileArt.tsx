/**
 * TEMPORARY ASSETS — `public/temp-reference/mood-*.webp` are cropped,
 * isolated slices of `refrenace.png`'s product photography (with the
 * reference's own page-level captions cropped out; any text visible
 * within the image, like "Good Mood Always" on the Bold tile, is part
 * of that phone case's own printed design, not a UI caption). These are
 * design-development placeholders, not a claim that separate production
 * photography exists — see docs/FRONTEND_PROGRESS.md for what should
 * replace them (real photos of the actual Different/Calm/Bold — or
 * whichever real collections the shop owner defines — products).
 */

export type MoodArtwork = "different" | "calm" | "bold";

const IMAGE_BY_ARTWORK: Record<MoodArtwork, string> = {
  different: "/temp-reference/mood-different.webp",
  calm: "/temp-reference/mood-calm.webp",
  bold: "/temp-reference/mood-bold.webp",
};

export function MoodTileArt({
  artwork,
  className,
}: {
  artwork: MoodArtwork;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={IMAGE_BY_ARTWORK[artwork]}
      alt=""
      aria-hidden
      className={className}
    />
  );
}
