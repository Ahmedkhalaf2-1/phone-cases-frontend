/**
 * Central place for reading environment configuration. Nothing else in the
 * app should read `process.env` directly, so switching between demo and
 * live data (or changing the backend URL) never requires touching
 * components.
 */

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

/** Base URL of the backend, already including the `/api/v1` prefix. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

/**
 * When true, the storefront renders local fixture data instead of calling
 * the backend. This is the explicit, visible switch required until a real
 * backend is reachable — never a silent fallback used after a failed
 * request.
 */
export const DEMO_MODE = readBoolean(process.env.NEXT_PUBLIC_DEMO_MODE, true);

/**
 * Public origin this site is served from — used for sitemap/robots URLs
 * and absolute Open Graph image URLs. Defaults to localhost for local
 * dev; set to the real deployed origin in production.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ??
  "http://localhost:3000"
);
