"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { adminClient } from "@/lib/admin/admin-client";
import { ApiError } from "@/lib/api/http";
import type { AuthSession, Staff } from "@/lib/admin/types";

const STORAGE_KEY = "admin-session";

/** What's actually persisted: the session plus when its access token
 * really expires, so a page reload can schedule refresh against the
 * *remaining* lifetime instead of restarting a full new one. */
interface StoredSession {
  session: AuthSession;
  expiresAt: number;
}

interface AdminAuthContextValue {
  staff: Staff | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
  /**
   * Runs `fn` with the current access token. If it fails with a 401
   * (token rejected — not a 403 permission failure, which refreshing
   * can never fix), refreshes once and retries `fn` exactly once with
   * the new token. Safe to call concurrently from multiple components:
   * the refresh itself is deduplicated, and retrying only ever happens
   * after an *unambiguous* 401 (the backend's auth guard rejected the
   * request before it reached any handler, so nothing was applied
   * server-side yet) — never after an ambiguous network failure, where
   * blindly retrying a non-idempotent mutation could double-submit it.
   */
  authorizedFetch: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStored(stored: StoredSession | null) {
  if (typeof window === "undefined") return;
  if (stored) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/** Parses "15m" / "3600s" / "1h" style durations into milliseconds. */
function parseExpiresIn(value: string): number | null {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1000;
  return amount * unitMs;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefreshRef = useRef<(stored: StoredSession) => void>(() => {});
  // Latest session, readable synchronously from callbacks that close over
  // a stale render (authorizedFetch in particular).
  const sessionRef = useRef<AuthSession | null>(null);
  // Shared in-flight refresh promise so a scheduled refresh, an on-demand
  // 401 recovery, and any other trigger never fire two overlapping
  // refresh-token rotations at once — the backend's rotation is one-shot
  // per token, so a second concurrent attempt would just fail and could
  // log the user out spuriously.
  const inFlightRefresh = useRef<Promise<AuthSession> | null>(null);
  // Set on logout so a refresh that was already in flight can't resurrect
  // the session after the user explicitly signed out.
  const loggedOutAt = useRef(0);

  const logout = useCallback(async () => {
    loggedOutAt.current = Date.now();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const stored = readStored();
    writeStored(null);
    sessionRef.current = null;
    setSession(null);
    if (stored?.session.refreshToken) {
      try {
        await adminClient.logout(stored.session.refreshToken);
      } catch {
        // Local state is already cleared either way — a failed
        // server-side revocation just means that refresh token expires
        // on its own later. Nothing to recover here, so we don't
        // surface an error for a logout the user already sees succeed.
      }
    }
  }, []);

  /** The one place a refresh actually happens — scheduled timer and
   * on-demand 401 recovery both go through this. */
  const performRefresh = useCallback((refreshToken: string): Promise<AuthSession> => {
    if (!inFlightRefresh.current) {
      const attemptedAt = loggedOutAt.current;
      inFlightRefresh.current = (async () => {
        try {
          const refreshed = await adminClient.refresh(refreshToken);
          if (loggedOutAt.current !== attemptedAt) {
            // Logged out while this was in flight — don't resurrect the session.
            throw new ApiError("Logged out during refresh.", undefined, undefined, undefined, "network");
          }
          const totalMs = parseExpiresIn(refreshed.expiresIn) ?? 0;
          const nextStored: StoredSession = {
            session: refreshed,
            expiresAt: Date.now() + totalMs,
          };
          writeStored(nextStored);
          sessionRef.current = refreshed;
          setSession(refreshed);
          scheduleRefreshRef.current(nextStored);
          return refreshed;
        } finally {
          inFlightRefresh.current = null;
        }
      })();
    }
    return inFlightRefresh.current;
  }, []);

  const scheduleRefresh = useCallback(
    (stored: StoredSession) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const refreshAt = stored.expiresAt - 0.2 * (stored.expiresAt - Date.now());
      const delay = Math.max(0, refreshAt - Date.now());

      refreshTimer.current = setTimeout(() => {
        performRefresh(stored.session.refreshToken).catch(() => {
          // Refresh token expired/invalid — require a real re-login
          // rather than silently pretending the session is still valid.
          void logout();
        });
      }, delay);
    },
    [performRefresh, logout],
  );
  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh;
  }, [scheduleRefresh]);

  const authorizedFetch = useCallback(
    async <T,>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
      const current = sessionRef.current;
      if (!current) {
        throw new ApiError("Not signed in.", 401, "UNAUTHORIZED");
      }
      try {
        return await fn(current.accessToken);
      } catch (err) {
        // Only a 401 (token itself rejected) is worth refreshing for — a
        // 403 means this staff member's role genuinely can't do this,
        // which a new token won't change, and any other failure
        // (network, 5xx, validation) isn't an auth problem at all.
        if (!(err instanceof ApiError) || err.status !== 401) throw err;
        let refreshed: AuthSession;
        try {
          refreshed = await performRefresh(current.refreshToken);
        } catch {
          await logout();
          throw new ApiError(
            "Your session expired. Please sign in again.",
            401,
            "SESSION_EXPIRED",
          );
        }
        // Retry exactly once. A 401 guard rejects before any handler
        // runs, so nothing was applied server-side by the first attempt
        // — retrying is safe even for a non-idempotent mutation.
        return fn(refreshed.accessToken);
      }
    },
    [performRefresh, logout],
  );

  useEffect(() => {
    // Reading localStorage must happen after mount (it doesn't exist during
    // server rendering) — this is synchronizing with an external system,
    // not mirroring props/state, so the setState calls belong here.
    const stored = readStored();
    sessionRef.current = stored?.session ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(stored?.session ?? null);
    setIsLoading(false);
    if (stored) scheduleRefresh(stored);

    // Multiple tabs share one refresh token. If another tab rotates it
    // (or logs out), pick that up here instead of this tab eventually
    // trying to refresh with a token the backend already revoked.
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      const updated = event.newValue ? (JSON.parse(event.newValue) as StoredSession) : null;
      sessionRef.current = updated?.session ?? null;
      setSession(updated?.session ?? null);
      if (updated) scheduleRefresh(updated);
      else if (refreshTimer.current) clearTimeout(refreshTimer.current);
    }
    window.addEventListener("storage", onStorage);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoginError(null);
      try {
        const newSession = await adminClient.login(email, password);
        const totalMs = parseExpiresIn(newSession.expiresIn) ?? 0;
        const stored: StoredSession = { session: newSession, expiresAt: Date.now() + totalMs };
        writeStored(stored);
        sessionRef.current = newSession;
        setSession(newSession);
        scheduleRefresh(stored);
      } catch (err) {
        setLoginError(
          err instanceof ApiError ? err.message : "Could not sign in.",
        );
        throw err;
      }
    },
    [scheduleRefresh],
  );

  return (
    <AdminAuthContext.Provider
      value={{
        staff: session?.staff ?? null,
        accessToken: session?.accessToken ?? null,
        isLoading,
        login,
        logout,
        loginError,
        authorizedFetch,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
