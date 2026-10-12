"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Auto-slide speed in px/second. */
const AUTO_SPEED = 32;
/** How long the rail stays still after the visitor touches, wheels or clicks it. */
const RESUME_DELAY_MS = 3000;

/**
 * Horizontal rail that slowly slides its cards on its own, in a seamless
 * loop (the cards are rendered twice and the scroll position wraps).
 *
 * The slide pauses on hover, keyboard focus, touch, wheel and arrow
 * clicks, and never starts when the visitor prefers reduced motion or the
 * cards already fit. Paused, it behaves like a normal scroll-snap rail.
 */
export function ProductRail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  // Whether the loop is enabled at all (overflowing + motion allowed).
  const [loops, setLoops] = useState(false);
  // Whether it is sliding right now (false while the visitor interacts).
  const [isSliding, setIsSliding] = useState(false);

  const isHovered = useRef(false);
  const isFocused = useRef(false);
  const isVisible = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  // Turn the loop on only when the single set of cards overflows and the
  // visitor hasn't asked for reduced motion.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => {
      if (motion.matches) return setLoops(false);
      // Once looping, the track holds two copies; judge by half of it.
      setLoops((current) =>
        current ? true : el.scrollWidth > el.clientWidth + 4,
      );
    };
    evaluate();
    motion.addEventListener("change", evaluate);
    return () => motion.removeEventListener("change", evaluate);
  }, []);

  const shouldSlide = useCallback(
    () => !isHovered.current && !isFocused.current && isVisible.current,
    [],
  );

  const resume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
    setIsSliding(shouldSlide());
  }, [shouldSlide]);

  /** Pause now and resume after a quiet period. */
  const pauseForInteraction = useCallback(() => {
    setIsSliding(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(resume, RESUME_DELAY_MS);
  }, [resume]);

  // Only slide while the rail is on screen.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !loops) return;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible.current = entry.isIntersecting;
      if (!resumeTimer.current) setIsSliding(shouldSlide());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loops, shouldSlide]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  // The animation itself.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !loops || !isSliding) return;

    const styles = getComputedStyle(el);
    const loopWidth = () =>
      // Track = padStart + copy + gap + copy + padEnd; one copy + gap is a loop.
      (el.scrollWidth -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight) +
        parseFloat(styles.columnGap || "0")) /
      2;

    // Fractional accumulator: browsers round scrollLeft, so tiny per-frame
    // steps would otherwise never move the rail.
    let position = el.scrollLeft;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const width = loopWidth();
      position += (AUTO_SPEED * (now - last)) / 1000;
      last = now;
      if (width > 0 && position >= width) position -= width;
      el.scrollLeft = position;
      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [loops, isSliding]);

  function page(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    pauseForInteraction();
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        isHovered.current = true;
        setIsSliding(false);
      }}
      onMouseLeave={() => {
        isHovered.current = false;
        if (!resumeTimer.current) resume();
      }}
      onFocus={() => {
        isFocused.current = true;
        setIsSliding(false);
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        isFocused.current = false;
        if (!resumeTimer.current) resume();
      }}
    >
      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        onPointerDown={pauseForInteraction}
        onTouchStart={pauseForInteraction}
        onWheel={pauseForInteraction}
        className={`no-scrollbar -mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 focus-visible:outline-none sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8 ${
          // Snapping fights the per-frame scroll (and would jump on hover-pause),
          // so it's only used for rails that don't loop.
          loops ? "" : "snap-x snap-mandatory"
        }`}
      >
        {children}
        {loops && (
          // Second copy for the seamless wrap — hidden from AT and tab order.
          <div aria-hidden inert className="contents">
            {children}
          </div>
        )}
      </div>

      <RailButton direction={-1} visible={canPrev} onClick={() => page(-1)} />
      <RailButton direction={1} visible={loops || canNext} onClick={() => page(1)} />
    </div>
  );
}

function RailButton({
  direction,
  visible,
  onClick,
}: {
  direction: 1 | -1;
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === 1 ? "Scroll right" : "Scroll left"}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      className={`absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-pill border border-border bg-surface text-ink shadow-lifted transition-all hover:border-accent hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex ${
        direction === 1 ? "-end-3" : "-start-3"
      } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={direction === -1 ? "rotate-180" : undefined}
      >
        <path
          d="M5 12h13M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
