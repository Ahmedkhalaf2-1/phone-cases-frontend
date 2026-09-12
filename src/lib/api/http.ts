import { API_BASE_URL } from "@/lib/env";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
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
    );
  }

  if (!response.ok) {
    throw new ApiError(
      `API request to ${url} failed with status ${response.status}.`,
      response.status,
    );
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
}

/**
 * General-purpose request helper for client-side mutations (cart, checkout,
 * receipt upload) that need custom methods/headers/bodies. Same contract as
 * `apiGet`: throws `ApiError`, never returns fabricated data on failure.
 */
export async function apiRequest<T>(
  path: string,
  { method = "GET", json, formData, headers = {} }: ApiRequestOptions = {},
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
    });
  } catch {
    throw new ApiError(
      `Could not reach the API at ${url}. Is the backend running and reachable?`,
    );
  }

  if (!response.ok) {
    let message = `API request to ${url} failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message)
          ? body.message.join(" ")
          : body.message;
      }
    } catch {
      // Response body wasn't JSON — keep the generic message.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
