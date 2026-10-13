import { useEffect, useState } from "react";

interface RemoteState<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * Loads data keyed by `key`; re-runs when the key changes and reports
 * `loading` while the stored result belongs to an older key, so a fast
 * typist never sees stale rows presented as current.
 */
export function useRemote<T>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<RemoteState<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ key, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            key,
            error: err instanceof Error ? err.message : "Could not load data.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // The key fully describes the request; the fetcher closure is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state && state.key === key ? state : null;
  return { data: current?.data, error: current?.error, loading: current === null };
}

/** Debounces a fast-changing value (search boxes) so we don't query per keystroke. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
