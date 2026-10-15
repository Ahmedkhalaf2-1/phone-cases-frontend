"use client";

import { useEffect, useRef, useState } from "react";
import { caseMockupFor, type CaseMockupConfig, type MockupRect } from "@/config/customize";

/**
 * Two kinds of case photo work:
 * - "hole": the printable back is transparent. The design goes underneath
 *   and the photo is drawn on top of it.
 * - "surface": a plain white case (no cut-out). The white back is found
 *   automatically, then the design is multiplied onto it, so the photo's
 *   shading and edges show through and the camera block stays untouched.
 */
type MockupMode = "hole" | "surface";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Mockup {
  image: HTMLImageElement;
  width: number;
  height: number;
  mode: MockupMode;
  /** Printable area as an alpha mask at the photo's full size. */
  mask: HTMLCanvasElement;
  /** Bounding box of the printable area, in photo pixels. */
  bounds: Bounds;
}

/** Pixels at or below this alpha count as "see-through". */
const ALPHA_THRESHOLD = 24;
/** How much darker than the case's middle a pixel may be and still count as case surface. */
const SURFACE_TOLERANCE = 55;
/** Above this (max - min of RGB) a pixel is colored, so not the white case. */
const SURFACE_MAX_SATURATION = 40;

function floodFill(width: number, height: number, seeds: number[], include: (index: number) => boolean): Uint8Array {
  const filled = new Uint8Array(width * height);
  const stack: number[] = [];
  const visit = (index: number) => {
    if (!filled[index] && include(index)) {
      filled[index] = 1;
      stack.push(index);
    }
  };
  seeds.forEach(visit);
  while (stack.length) {
    const index = stack.pop()!;
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
  return filled;
}

function boundsOf(selected: Uint8Array, width: number): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < selected.length; index++) {
    if (!selected[index]) continue;
    const x = index % width;
    const y = (index - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Turns a 0/1 selection into a softly-edged alpha mask canvas. */
function maskCanvas(selected: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const raw = document.createElement("canvas");
  raw.width = width;
  raw.height = height;
  const rawContext = raw.getContext("2d")!;
  const pixels = rawContext.createImageData(width, height);
  for (let index = 0; index < selected.length; index++) {
    pixels.data[index * 4 + 3] = selected[index] ? 255 : 0;
  }
  rawContext.putImageData(pixels, 0, 0);

  // Feather the edge a touch so it doesn't look cut out with scissors.
  const soft = document.createElement("canvas");
  soft.width = width;
  soft.height = height;
  const softContext = soft.getContext("2d")!;
  softContext.filter = "blur(1px)";
  softContext.drawImage(raw, 0, 0);
  return soft;
}

function insideRoundedRect(px: number, py: number, rect: MockupRect) {
  const r = Math.min(rect.radius ?? 0, rect.width / 2, rect.height / 2);
  if (px < rect.x || py < rect.y || px >= rect.x + rect.width || py >= rect.y + rect.height) return false;
  const cx = Math.min(Math.max(px, rect.x + r), rect.x + rect.width - r);
  const cy = Math.min(Math.max(py, rect.y + r), rect.y + rect.height - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function forEachInRect(width: number, height: number, rect: MockupRect, visit: (index: number) => void) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (insideRoundedRect(x + 0.5, y + 0.5, rect)) visit(y * width + x);
    }
  }
}

/**
 * Applies the configured overrides to a selection: `include` areas become
 * printable where the photo is opaque, then `exclude` areas (e.g. the
 * camera plateau) are removed.
 */
function applyOverrides(
  selected: Uint8Array,
  width: number,
  height: number,
  isOpaque: (index: number) => boolean,
  overrides: Pick<CaseMockupConfig, "include" | "exclude">,
) {
  for (const rect of overrides.include ?? []) {
    forEachInRect(width, height, rect, (i) => {
      if (isOpaque(i)) selected[i] = 1;
    });
  }
  for (const rect of overrides.exclude ?? []) {
    forEachInRect(width, height, rect, (i) => {
      selected[i] = 0;
    });
  }
}

function analyse(
  image: HTMLImageElement,
  overrides: Pick<CaseMockupConfig, "include" | "exclude" | "maxSaturation"> = {},
): Mockup | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  const alpha = (index: number) => data[index * 4 + 3];

  const borderSeeds: number[] = [];
  for (let x = 0; x < width; x++) borderSeeds.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) borderSeeds.push(y * width, y * width + width - 1);

  // 1) A transparent cut-out enclosed by the case?
  const outside = floodFill(width, height, borderSeeds, (i) => alpha(i) <= ALPHA_THRESHOLD);
  const hole = new Uint8Array(width * height);
  for (let i = 0; i < hole.length; i++) hole[i] = alpha(i) <= ALPHA_THRESHOLD && !outside[i] ? 1 : 0;
  applyOverrides(hole, width, height, (i) => alpha(i) > 200, { exclude: overrides.exclude });
  const holeBounds = boundsOf(hole, width);
  if (holeBounds && holeBounds.width * holeBounds.height > width * height * 0.05) {
    return { image, width, height, mode: "hole", mask: maskCanvas(hole, width, height), bounds: holeBounds };
  }

  // 2) Otherwise: the white surface around the middle of the case.
  const caseBounds = boundsOf(
    Uint8Array.from({ length: width * height }, (_, i) => (alpha(i) > 200 ? 1 : 0)),
    width,
  );
  if (!caseBounds) return null;
  const brightness = (i: number) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const saturation = (i: number) =>
    Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) - brightness(i);

  // Seed from the lower part of the case (well away from the camera),
  // nudging down until it lands on an opaque, light pixel. A few columns are
  // tried so a centre stripe splitting the back doesn't hide half of it.
  const maxSaturation = overrides.maxSaturation ?? SURFACE_MAX_SATURATION;
  const surface = new Uint8Array(width * height);
  let seeded = false;
  for (const fraction of [0.5, 0.3, 0.7]) {
    const sx = Math.round(caseBounds.x + caseBounds.width * fraction);
    let seed = -1;
    for (let y = Math.round(caseBounds.y + caseBounds.height * 0.6); y < caseBounds.y + caseBounds.height; y++) {
      const i = y * width + sx;
      if (alpha(i) > 200 && saturation(i) < maxSaturation) {
        seed = i;
        break;
      }
    }
    if (seed < 0 || surface[seed]) continue;
    seeded = true;
    const floor = brightness(seed) - SURFACE_TOLERANCE;
    const region = floodFill(
      width,
      height,
      [seed],
      (i) => alpha(i) > 200 && brightness(i) >= floor && saturation(i) < maxSaturation,
    );
    for (let i = 0; i < region.length; i++) if (region[i]) surface[i] = 1;
  }
  if (!seeded) return null;
  applyOverrides(surface, width, height, (i) => alpha(i) > 200, overrides);
  const surfaceBounds = boundsOf(surface, width);
  if (!surfaceBounds) return null;
  return { image, width, height, mode: "surface", mask: maskCanvas(surface, width, height), bounds: surfaceBounds };
}

const cache = new Map<string, Promise<Mockup | null>>();

function loadMockup(config: CaseMockupConfig): Promise<Mockup | null> {
  let pending = cache.get(config.src);
  if (!pending) {
    pending = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        let mockup: Mockup | null = null;
        try {
          mockup = analyse(image, config);
        } catch {
          mockup = null;
        }
        if (!mockup && process.env.NODE_ENV !== "production") {
          console.warn(`[customize] Couldn't find a printable area in ${config.src} — using the server preview.`);
        }
        resolve(mockup);
      };
      image.onerror = () => resolve(null);
      image.src = config.src;
    });
    cache.set(config.src, pending);
  }
  return pending;
}

/**
 * The case photo for this phone model (or the generic one), if it exists
 * and has a usable printable area.
 */
export function useCaseMockup(phoneModelSlug?: string, brandSlug?: string): { mockup: Mockup | null; isLoading: boolean } {
  const config = caseMockupFor(phoneModelSlug, brandSlug);
  const [state, setState] = useState<{ src: string | null; mockup: Mockup | null }>({ src: null, mockup: null });
  useEffect(() => {
    let cancelled = false;
    loadMockup(config).then((mockup) => {
      if (!cancelled) setState({ src: config.src, mockup });
    });
    return () => {
      cancelled = true;
    };
    // `config` is derived from the slug; its src identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.src]);
  // Keep showing the previous photo until the new one is ready.
  return { mockup: state.mockup, isLoading: state.src !== config.src };
}

/** Draws `design` into the printable area, covering it from the center — the same crop the backend prints. */
function render(canvas: HTMLCanvasElement, mockup: Mockup, design: HTMLImageElement | null) {
  const { width, height, bounds, image, mask, mode } = mockup;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, width, height);

  // The design, clipped to the printable area, on its own layer.
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerContext = layer.getContext("2d")!;
  if (design) {
    const scale = Math.max(bounds.width / design.naturalWidth, bounds.height / design.naturalHeight);
    const drawWidth = design.naturalWidth * scale;
    const drawHeight = design.naturalHeight * scale;
    layerContext.drawImage(
      design,
      bounds.x + (bounds.width - drawWidth) / 2,
      bounds.y + (bounds.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    layerContext.globalCompositeOperation = "destination-in";
    layerContext.drawImage(mask, 0, 0);
  }

  if (mode === "hole") {
    context.drawImage(layer, 0, 0);
    context.drawImage(image, 0, 0);
  } else {
    context.drawImage(image, 0, 0);
    // Multiply keeps the photo's shading: white × design = design, and the
    // case's soft shadows darken it naturally.
    context.globalCompositeOperation = "multiply";
    context.drawImage(layer, 0, 0);
    context.globalCompositeOperation = "source-over";
  }
}

/** The customer's image on the real case photo. `file` null shows the blank case. */
export function CaseMockup({ mockup, file, alt }: { mockup: Mockup; file: File | null; alt: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!file) {
      render(canvas, mockup, null);
      return;
    }
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const design = new Image();
    design.onload = () => {
      if (!cancelled) render(canvas, mockup, design);
      URL.revokeObjectURL(url);
    };
    design.onerror = () => URL.revokeObjectURL(url);
    design.src = url;
    return () => {
      cancelled = true;
    };
  }, [mockup, file]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className="mx-auto block h-full max-w-full object-contain"
      style={{ aspectRatio: `${mockup.width} / ${mockup.height}` }}
    />
  );
}
