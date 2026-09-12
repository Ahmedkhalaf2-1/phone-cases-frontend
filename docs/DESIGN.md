# Design system

Source of truth for this milestone: `refrenace.png` (approved reference,
filename intentionally spelled that way — do not rename it).

## Colors

| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Page background |
| `--foreground` | `#141414` | Primary text |
| `--ink` | `#141210` | Headings, footer background, high-contrast fills |
| `--muted-foreground` | `#5C5952` | Secondary text (AA on white and on `--surface`) |
| `--border` | `#E4E0D8` | Hairlines, card borders |
| `--surface` | `#F3F2EF` | Soft product/section backgrounds |
| `--accent` | `#FF4D1A` | CTAs, hover states, selective highlights only |
| `--accent-foreground` | `#FFFFFF` | Text on accent fills |

Orange is used selectively (hover states, one CTA, small accents) — the
composition stays white-dominant, matching the reference.

## Typography

- Display / headings: **Anton** (`--font-display`), condensed, bold,
  uppercase — loaded via `next/font/google` with system-ui/sans-serif
  fallback, self-hosted at build time (no runtime font request).
- Body / UI text: **Inter** (`--font-body`), same loading strategy.
- Headings are set uppercase with tight leading (`leading-[0.92]` on the
  hero H1) to match the reference's condensed display type.

## Layout rules

- Container: `max-w-[1440px]` with `px-4 sm:px-6 lg:px-10` on the
  marketing/browsing pages (home, header, footer, `/phone-cases`,
  product detail) — consistent across every section. Narrower reading
  widths (`max-w-3xl`/`max-w-5xl`) are used deliberately for
  form-centric pages (cart, checkout, order tracking) — those aren't
  part of this shared container.
- Hero targets ~500px tall at a 1440px viewport (43%/57% text/visual
  split), not a full-viewport or tall-portrait layout.
- Corner radii: small/restrained (`rounded-sm`, `rounded-md`); no large
  radii or pill shapes except the CTA button ends and icon buttons.
- Shadows: restrained — `drop-shadow` on collage artwork and one
  `shadow-md` badge; no heavy elevation.
- CSS logical properties (`ps-`, `pe-`, `start-`, `end-`, `text-start`)
  are used wherever inline-direction spacing/positioning applies, so a
  future RTL (Arabic) layout does not require rebuilding components.
  Full Arabic translation and `dir="rtl"` support are out of scope for
  this milestone.

## Motion rules

- Restrained only: a short hero entrance (`animate-rise-in`,
  ~0.6s ease-out), a mobile-menu height transition, hover scale on
  collection/product imagery, and a small arrow translation on hover.
- All motion is CSS-based; no animation dependency was added.
- `prefers-reduced-motion: reduce` collapses all durations to effectively
  zero via a global rule in `globals.css`.
- No scroll hijacking, custom cursors, or looping/perpetual animation.

## Accessibility

- Every interactive element has a visible `focus-visible` outline using
  the accent color.
- Headings are semantic and in document order (`h1` in the hero, `h2` per
  section).
- The mobile menu toggle uses `aria-expanded`/`aria-controls`, closes on
  `Escape`, and the closed panel is marked `inert` (not just visually
  collapsed) so its links leave the tab order and accessibility tree.
- Touch targets are at least ~44px (`min-h-11`/`min-w-11`) on header
  icons, the mobile menu button, and cart quantity controls.

## Image assets

- `public/temp-reference/*.webp` are **temporary, documented crops** of
  `refrenace.png` — isolated product photography (hero collage, the
  three mood-tile photos, the four demo product shots), with the
  reference's own page-level captions cropped out wherever practical so
  they don't duplicate this app's real HTML text. They exist only
  because no real product photography has been supplied yet; see
  `docs/FRONTEND_PROGRESS.md` for exactly what should replace each one.
  Never treat their presence as evidence that production assets exist.
- Where a crop was technically impossible without also cutting into the
  product itself (e.g. "Bold" tile's "Good Mood Always" sticker), that
  text is part of the photographed product's own design, not a page
  caption — it's left in intentionally.
