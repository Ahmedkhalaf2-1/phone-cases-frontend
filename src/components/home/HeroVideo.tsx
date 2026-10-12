"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's background video. After mount it re-asserts muted playback
 * and calls play(), because mobile browsers (iOS Safari especially) can
 * skip the `autoplay` attribute. It retries when the video becomes
 * playable and when the tab returns from the background. If the browser
 * still blocks autoplay (e.g. iOS Low Power Mode), the video stays stopped.
 */
export function HeroVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (!video.paused) return;
      video.muted = true;
      video.play().catch(() => {
        // Blocked by browser policy — leave it stopped.
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tryPlay();
    };

    tryPlay();
    video.addEventListener("canplay", tryPlay);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className="h-full w-full object-cover"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
