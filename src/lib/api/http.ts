import { API_BASE_URL } from "@/lib/env";

/**
 * `kind` distinguishes failure classes callers actually need to branch on:
 * - "network": the request never reached the server (offline, DNS, CORS,
 *   timeout). The resource in question may still be perfectly valid.
 * - "http": the server responded with a non-2xx status. `status`/`code`/
 *   `details` come straight from the backend's structured error body
 *   (see `all-exceptions.filter.ts`): `{ statusCode, code, message, details }`.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly kind: "network" | "http" = "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Joins the configured API base URL (which already includes `/api/v1`)
 * with an endpoint path, guaranteeing `/api/v1` appears exactly once no
 * matter how the base URL or path are written.
 */
export function buildApiUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!API_BASE_URL) {
    throw new ApiError(
      "NEXT_PUBLIC_API_BASE_URL is not configured. Set it in .env.local.",
      undefined,
      "CONFIG_MISSING",
      undefined,
      "network",
    );
  }

  const base = API_BASE_URL.replace(/\/+$/, "");
  const cleanPath = `/${path.replace(/^\/+/, "")}`;
  const url = new URL(`${base}${cleanPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

interface BackendErrorBody {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

async function parseErrorBody(response: Response): Promise<{
  message: string;
  code?: string;
  details?: unknown;
}> {
  let message = `API request failed with status ${response.status}.`;
  let code: string | undefined;
  let details: unknown;
  try {
    const body = (await response.json()) as BackendErrorBody;
    if (body?.message) {
      message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
    }
    code = body?.code;
    details = body?.details;
  } catch {
    // Response body wasn't JSON — keep the generic message, no code/details.
  }
  return { message, code, details };
}

/**
 * Thin fetch wrapper for the live backend. Throws `ApiError` on any
 * non-OK response or network failure — callers must never catch this and
 * substitute demo data silently.
 */
export async function apiGet<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = buildApiUrl(path, query);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Homepage content changes rarely; revalidate periodically rather
      // than caching forever or refetching on every request.
      next: { revalidate: 60 },
    });
  } catch {
    throw new ApiError(
      `Could not reach the API at ${url}. Is the backend running and reachable?`,
      undefined,
      undefined,
      undefined,
      "network",
    );
  }

  if (!response.ok) {
    const { message, code, details } = await parseErrorBody(response);
    throw new ApiError(message, response.status, code, details, "http");
  }

  return (await response.json()) as T;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** JSON body — mutually exclusive with `formData`. */
  json?: unknown;
  /** multipart/form-data body — mutually exclusive with `json`. */
  formData?: FormData;
  headers?: Record<string, string>;
  /** Abort the underlying fetch if this signal fires (for stale-response guarding). */
  signal?: AbortSignal;
}

/**
 * General-purpose request helper for client-side mutations (cart, checkout,
 * receipt upload) that need custom methods/headers/bodies. Same contract as
 * `apiGet`: throws `ApiError`, never returns fabricated data on failure.
 */
export async function apiRequest<T>(
  path: string,
  { method = "GET", json, formData, headers = {}, signal }: ApiRequestOptions = {},
): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: formData ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      `Could not reach the API at ${url}. Is the backend running and reachable?`,
      undefined,
      undefined,
      undefined,
      "network",
    );
  }

  if (!response.ok) {
    const { message, code, details } = await parseErrorBody(response);
    throw new ApiError(message, response.status, code, details, "http");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
