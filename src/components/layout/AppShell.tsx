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
 * `SiteSidebar` is `position: fixed` (not a flex sibling) specifically so
 * it never participates in flex/box sizing of the content column.
 *
 * NOTE: the rail width `calc(68px+12px)` (sidebar width + gutter gap)
 * appears twice below — once on the gutter backdrop, once as the content
 * column's left offset. Tailwind's arbitrary-value classes must be
 * literal strings for its scanner to pick up, so this can't be factored
 * into one shared JS constant; keep both occurrences equal if either
 * changes.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <div className="min-h-full bg-background">
      {/* Backdrop for the sidebar-to-shell gutter: the fixed sidebar only
          paints x:0-68px, so without this the gap would show the canvas
          gray behind it instead of reading as part of the sidebar's own
          rail. Kept a hair off pure white (#fafafa, same as the sidebar)
          so the MainShell's #ffffff still stands out as the primary
          surface. */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[calc(68px+12px)] bg-[#fafafa] lg:block" />
      <SiteSidebar />
      <div className="lg:pt-[12px] lg:pr-[18px] lg:pb-[18px] lg:pl-[calc(68px+12px)]">
        <div className="min-h-full lg:flex lg:min-h-[calc(100vh-30px)] lg:flex-col lg:overflow-hidden lg:rounded-[32px] lg:bg-surface lg:shadow-[0_2px_10px_rgba(0,0,0,0.025),0_12px_36px_rgba(0,0,0,0.04)]">
          {children}
        </div>
      </div>
    </div>
  );
}
