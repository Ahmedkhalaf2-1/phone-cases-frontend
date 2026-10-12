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

/**
 * Base URL of the backend, already including the `/api/v1` prefix.
 *
 * Set either:
 * - NEXT_PUBLIC_API_BASE_URL — full base, e.g. https://api.contrastco.tech/api/v1
 * - NEXT_PUBLIC_API_URL — backend origin only, e.g. https://api.contrastco.tech
 *   (`/api/v1` is appended). Used only when NEXT_PUBLIC_API_BASE_URL is unset.
 *
 * NEXT_PUBLIC_* values are baked in at `next build`, so set them before building.
 */
function resolveApiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (base) return base;
  const origin = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  return origin ? `${origin}/api/v1` : "";
}

export const API_BASE_URL = resolveApiBaseUrl();

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
