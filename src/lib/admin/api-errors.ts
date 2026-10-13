import { ApiError } from "@/lib/api/http";

/** The individual validation messages carried by an API error, or its summary message. */
export function apiErrorMessages(err: unknown): string[] {
  if (!(err instanceof ApiError)) return [];
  const details = Array.isArray(err.details)
    ? (err.details as unknown[]).filter((d): d is string => typeof d === "string")
    : [];
  return details.length > 0 ? details : [err.message];
}
