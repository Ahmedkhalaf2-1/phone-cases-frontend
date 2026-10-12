import { HeroVideo } from "@/components/home/HeroVideo";

export function Hero({
  videoSrc = "/hero-video.mp4",
  mobileVideoSrc = "/hero-video-mobile.mp4",
}: {
  videoSrc?: string;
  mobileVideoSrc?: string;
}) {
  return (
    <section className="w-full">
      {/* Full-Width 16:9 Video Banner (Edge to Edge) */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 shadow-md">
        <HeroVideo src={videoSrc} mobileSrc={mobileVideoSrc} />
      </div>
    </section>
  );
}
