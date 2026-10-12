/**
 * The real case photo the customer's design is previewed on in /customize.
 * Either kind of PNG works, and the printable area is found automatically:
 * - A plain white/light case on a transparent or plain background. The
 *   white back is detected, the camera block is left out, and the design
 *   is multiplied onto it so the photo's shading shows through.
 * - A case whose printable back is a transparent cut-out. The design goes
 *   underneath the photo.
 * If the file is missing or no printable area is found, the page falls
 * back to the backend's generic preview.
 */
export const CASE_MOCKUP_SRC = "/customize/case-mockup.png";

/** A rounded rectangle in the mockup's own pixel coordinates. */
export interface MockupRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface CaseMockupConfig {
  src: string;
  /**
   * Areas never printed on, for photos where the camera block is too close
   * in colour to the case for automatic detection to leave it out.
   */
  exclude?: MockupRect[];
}

/**
 * Model-specific case photos, keyed by phone model slug. Models not listed
 * use the generic CASE_MOCKUP_SRC.
 */
export const CASE_MOCKUPS_BY_MODEL: Record<string, CaseMockupConfig> = {
  "iphone-17-pro-max": {
    src: "/customize/case-mockup-iphone-17-pro-max.png",
    // Camera plateau and its raised rim (1024×1536 image).
    exclude: [{ x: 180, y: 56, width: 662, height: 404, radius: 62 }],
  },
};

export function caseMockupFor(phoneModelSlug: string | undefined): CaseMockupConfig {
  return (phoneModelSlug && CASE_MOCKUPS_BY_MODEL[phoneModelSlug]) || { src: CASE_MOCKUP_SRC };
}
