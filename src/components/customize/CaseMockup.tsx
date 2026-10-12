"use client";

import { useEffect, useRef, useState } from "react";
import { CASE_MOCKUP_SRC } from "@/config/customize";

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

function analyse(image: HTMLImageElement): Mockup | null {
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

  // Seed from the lower middle of the case (well away from the camera),
  // nudging down until it lands on an opaque, light pixel.
  const cx = Math.round(caseBounds.x + caseBounds.width / 2);
  let seed = -1;
  for (let y = Math.round(caseBounds.y + caseBounds.height * 0.6); y < caseBounds.y + caseBounds.height; y++) {
    const i = y * width + cx;
    if (alpha(i) > 200 && saturation(i) < SURFACE_MAX_SATURATION) {
      seed = i;
      break;
    }
  }
  if (seed < 0) return null;
  const floor = brightness(seed) - SURFACE_TOLERANCE;
  const surface = floodFill(
    width,
    height,
    [seed],
    (i) => alpha(i) > 200 && brightness(i) >= floor && saturation(i) < SURFACE_MAX_SATURATION,
  );
  const surfaceBounds = boundsOf(surface, width);
  if (!surfaceBounds) return null;
  return { image, width, height, mode: "surface", mask: maskCanvas(surface, width, height), bounds: surfaceBounds };
}

let cached: Promise<Mockup | null> | null = null;

function loadMockup(): Promise<Mockup | null> {
  cached ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      let mockup: Mockup | null = null;
      try {
        mockup = analyse(image);
      } catch {
        mockup = null;
      }
      if (!mockup && process.env.NODE_ENV !== "production") {
        console.warn(`[customize] Couldn't find a printable area in ${CASE_MOCKUP_SRC} — using the server preview.`);
      }
      resolve(mockup);
    };
    image.onerror = () => resolve(null);
    image.src = CASE_MOCKUP_SRC;
  });
  return cached;
}

/** The case photo, if it exists and has a usable printable area. */
export function useCaseMockup(): { mockup: Mockup | null; isLoading: boolean } {
  const [state, setState] = useState<{ mockup: Mockup | null; isLoading: boolean }>({
    mockup: null,
    isLoading: true,
  });
  useEffect(() => {
    let cancelled = false;
    loadMockup().then((mockup) => {
      if (!cancelled) setState({ mockup, isLoading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
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
