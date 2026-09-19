"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteSidebar } from "@/components/layout/SiteSidebar";

/**
 * Desktop-only "floating app shell": a fixed icon sidebar plus one large
 * rounded surface holding the whole site (header/page/footer, unchanged
 * inside). Below `lg` this renders as a plain full-bleed page — the
 * sidebar and rounded shell are a desktop affordance, not something we
 * force onto mobile (no 68px rail eating mobile width, no horizontal
 * scroll).
 *
 * Admin routes opt out entirely (not just the sidebar): they have their
 * own nav/layout in admin/layout.tsx, and reserving the sidebar's
 * offset there would leave a blank gutter with nothing filling it.
 *
 * The nav icons themselves (`SiteSidebar`) stay `position: fixed` so
 * they're visible regardless of scroll position — but the rail's
 * background color below is `absolute`, not `fixed`: a `fixed` element
 * is always exactly viewport-height, so on any page taller than one
 * screen it stopped covering the rail past the first scroll, letting
 * the gray canvas leak through underneath. `absolute` against the
 * `relative` wrapper here spans the full document height instead.
 *
 * The sidebar and this rail layer both use `bg-background` (the same
 * token as the outer canvas) so the sidebar visually disappears into
 * the canvas rather than reading as its own surface — only the white
 * MainShell should stand out.
 *
 * NOTE: the rail width `calc(68px+12px)` (sidebar width + gutter gap)
 * appears twice below — once on the rail background, once as the
 * content column's left offset. Tailwind's arbitrary-value classes must
 * be literal strings for its scanner to pick up, so this can't be
 * factored into one shared JS constant; keep both occurrences equal if
 * either changes.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <div className="relative min-h-full bg-background">
      {/* Technically redundant with the outer wrapper's own bg-background
          (same color, same area) — kept explicit so this rail's fill
          doesn't silently depend on the wrapper never changing. */}
      <div className="absolute inset-y-0 left-0 z-30 hidden w-[calc(68px+12px)] bg-background lg:block" />
      <SiteSidebar />
      <div className="lg:pt-[12px] lg:pr-[18px] lg:pb-[18px] lg:pl-[calc(68px+12px)]">
        <div className="min-h-full lg:flex lg:min-h-[calc(100vh-30px)] lg:flex-col lg:overflow-hidden lg:rounded-[32px] lg:bg-surface lg:shadow-[0_2px_10px_rgba(0,0,0,0.025),0_12px_36px_rgba(0,0,0,0.04)]">
          {children}
        </div>
      </div>
    </div>
  );
}
