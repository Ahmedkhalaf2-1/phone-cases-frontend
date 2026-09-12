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
  // Shared in-flight refresh promise so a scheduled refresh and any other
  // trigger never fire two overlapping refresh-token rotations at once —
  // the backend's rotation is one-shot per token, so a second concurrent
  // attempt would just fail and could log the user out spuriously.
  const inFlightRefresh = useRef<Promise<void> | null>(null);
  // Set on logout so a refresh that was already in flight can't resurrect
  // the session after the user explicitly signed out.
  const loggedOutAt = useRef(0);

  const logout = useCallback(async () => {
    loggedOutAt.current = Date.now();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const stored = readStored();
    writeStored(null);
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

  const scheduleRefresh = useCallback(
    (stored: StoredSession) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const attemptedAt = loggedOutAt.current;
      const refreshAt = stored.expiresAt - 0.2 * (stored.expiresAt - Date.now());
      const delay = Math.max(0, refreshAt - Date.now());

      refreshTimer.current = setTimeout(() => {
        if (!inFlightRefresh.current) {
          inFlightRefresh.current = (async () => {
            try {
              const refreshed = await adminClient.refresh(stored.session.refreshToken);
              // Ignore this result if the user logged out while it was in flight.
              if (loggedOutAt.current !== attemptedAt) return;
              const totalMs = parseExpiresIn(refreshed.expiresIn) ?? 0;
              const nextStored: StoredSession = {
                session: refreshed,
                expiresAt: Date.now() + totalMs,
              };
              writeStored(nextStored);
              setSession(refreshed);
              scheduleRefreshRef.current(nextStored);
            } catch {
              // Refresh token expired/invalid — require a real re-login
              // rather than silently pretending the session is still valid.
              if (loggedOutAt.current === attemptedAt) void logout();
            } finally {
              inFlightRefresh.current = null;
            }
          })();
        }
      }, delay);
    },
    [logout],
  );
  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh;
  }, [scheduleRefresh]);

  useEffect(() => {
    // Reading localStorage must happen after mount (it doesn't exist during
    // server rendering) — this is synchronizing with an external system,
    // not mirroring props/state, so the setState calls belong here.
    const stored = readStored();
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
