"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Mirrors the CSS tokens in globals.css (--sf-ease, --sf-dur-*). */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DUR = { fast: 140, normal: 240, slow: 340 } as const;
/** Only the first screenful is staggered; anything further just appears. */
const STAGGER_MAX_ITEMS = 8;
const STAGGER_STEP_MS = 30;

type Frames = Keyframe[];

function play(
  el: Element,
  frames: Frames,
  options: { duration: number; delay?: number; easing?: string },
) {
  // `backwards` holds the first frame during the delay and then hands
  // control back to the element's own styles - nothing lingers (no stuck
  // transform / containing block, no stuck opacity).
  el.animate(frames, { fill: "backwards", easing: EASE, ...options });
}

const FADE_RISE: Frames = [
  { opacity: 0, transform: "translateY(10px)" },
  { opacity: 1, transform: "translateY(0)" },
];
const FADE: Frames = [{ opacity: 0 }, { opacity: 1 }];

function playNavigationMotion(root: ParentNode) {
  for (const el of root.querySelectorAll('[data-motion="page"]')) {
    play(el, FADE_RISE, { duration: DUR.normal });
  }
  // Transactional pages (checkout): opacity only, shorter.
  for (const el of root.querySelectorAll('[data-motion="quiet"]')) {
    play(el, FADE, { duration: 160, easing: "ease-out" });
  }
  for (const el of root.querySelectorAll('[data-motion="fade"]')) {
    play(el, FADE, { duration: 180, easing: "ease-out" });
  }
  // Secondary content settles a beat after the primary (image) content.
  for (const el of root.querySelectorAll('[data-motion="rise"]')) {
    play(el, FADE_RISE, { duration: DUR.normal, delay: 70 });
  }
  for (const container of root.querySelectorAll("[data-motion-stagger]")) {
    Array.from(container.children)
      .slice(0, STAGGER_MAX_ITEMS)
      .forEach((child, index) => {
        play(child, FADE, {
          duration: 220,
          delay: 40 + index * STAGGER_STEP_MS,
          easing: "ease-out",
        });
      });
  }
}

/**
 * Plays the storefront's page-entrance motion on client-side navigations.
 *
 * - Mounted only in the storefront branch of AppShell, so Admin is never
 *   involved.
 * - Does nothing on the first render: server-rendered content must paint
 *   instantly (no fade on hard loads / new tabs / refreshes).
 * - Runs in a layout effect, i.e. after the new page's DOM is committed
 *   but BEFORE the browser paints it, so the page never flashes at full
 *   opacity first.
 * - Never delays navigation: it only animates content that is already
 *   there. No exit animation, no waiting.
 * - Skips browser back/forward navigations (they stay instant).
 * - Respects prefers-reduced-motion by not animating at all.
 */
export function StorefrontMotion() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  // Set by popstate (browser back/forward/swipe) just before the router
  // commits that navigation. History traversals stay instant - that is what
  // visitors expect from "back", it keeps scroll restoration clean, and it
  // matches React, which does not run view transitions for them either.
  const traversal = useRef(false);

  useEffect(() => {
    let expire: ReturnType<typeof setTimeout> | undefined;
    const onPopState = () => {
      traversal.current = true;
      // A popstate that never changes the pathname (e.g. a #hash step) must
      // not swallow the next real navigation's entrance.
      clearTimeout(expire);
      expire = setTimeout(() => {
        traversal.current = false;
      }, 1000);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      clearTimeout(expire);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useLayoutEffect(() => {
    if (previous.current === null) {
      previous.current = pathname;
      return;
    }
    if (previous.current === pathname) return;
    previous.current = pathname;

    if (traversal.current) {
      traversal.current = false;
      return;
    }

    if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    playNavigationMotion(document);
  }, [pathname]);

  return null;
}
