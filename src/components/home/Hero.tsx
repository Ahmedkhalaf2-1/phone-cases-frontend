/**
 * Fallback poster image while the video loads or if video is unavailable.
 */
const POSTER_IMAGE = "/temp-reference/hero-collage.webp";

export function Hero({ videoSrc = "/hero-video.mp4" }: { videoSrc?: string }) {
  return (
    <section className="w-full">
      {/* Full-Width 16:9 Video Banner (Edge to Edge) */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 shadow-md">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={POSTER_IMAGE}
          className="h-full w-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      </div>
    </section>
  );
}
