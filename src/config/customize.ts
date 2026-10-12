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
   * Areas always printed on (where the case is opaque), e.g. the case's
   * raised camera lip, whose shadowed groove automatic detection skips.
   */
  include?: MockupRect[];
  /**
   * Areas never printed on, for photos where the phone's camera plateau is
   * too close in colour to the case for automatic detection to leave it out.
   * Applied after `include`.
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
    // 1024×1536 image. The case's camera lip (including its groove) takes
    // the design; only the phone's silver camera plateau inside it doesn't.
    include: [{ x: 190, y: 66, width: 646, height: 384, radius: 66 }],
    exclude: [{ x: 218, y: 88, width: 586, height: 328, radius: 40 }],
  },
};

export function caseMockupFor(phoneModelSlug: string | undefined): CaseMockupConfig {
  return (phoneModelSlug && CASE_MOCKUPS_BY_MODEL[phoneModelSlug]) || { src: CASE_MOCKUP_SRC };
}
