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
