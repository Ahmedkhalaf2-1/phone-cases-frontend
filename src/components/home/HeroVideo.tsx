"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's background video. After mount it re-asserts muted playback
 * and calls play(), because mobile browsers (iOS Safari especially) can
 * skip the `autoplay` attribute. It retries when the video becomes
 * playable and when the tab returns from the background. If the browser
 * still blocks autoplay (e.g. iOS Low Power Mode), the video stays stopped.
 */
export function HeroVideo({ src, mobileSrc }: { src: string; mobileSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // iOS Safari / Brave only allow autoplay for video that is muted and
    // inline at the moment play() runs — set both as properties *and*
    // attributes, since some engines check one and some the other.
    const ensureMutedInline = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
    };

    const tryPlay = () => {
      if (!video.paused) return;
      ensureMutedInline();
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
      {/* Phones (below Tailwind's `sm`) get the lighter 540p, video-only
          file. Browsers pick the first <source> whose media matches, so the
          mobile one must come first; wider screens skip it and never fetch it. */}
      {mobileSrc && <source src={mobileSrc} type="video/mp4" media="(max-width: 639px)" />}
      <source src={src} type="video/mp4" />
    </video>
  );
}
