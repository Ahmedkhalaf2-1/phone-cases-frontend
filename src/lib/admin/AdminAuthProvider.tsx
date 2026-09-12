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

interface AdminAuthContextValue {
  staff: Staff | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loginError: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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
  const scheduleRefreshRef = useRef<(session: AuthSession) => void>(() => {});

  const logout = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    writeSession(null);
    setSession(null);
  }, []);

  const scheduleRefresh = useCallback(
    (activeSession: AuthSession) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const totalMs = parseExpiresIn(activeSession.expiresIn);
      if (!totalMs) return;
      // Refresh at 80% of the token lifetime so it renews before expiry.
      const delay = Math.max(5_000, totalMs * 0.8);
      refreshTimer.current = setTimeout(async () => {
        try {
          const refreshed = await adminClient.refresh(activeSession.refreshToken);
          writeSession(refreshed);
          setSession(refreshed);
          scheduleRefreshRef.current(refreshed);
        } catch {
          // Refresh token expired/invalid — require a real re-login rather
          // than silently pretending the session is still valid.
          logout();
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
    const stored = readSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(stored);
    setIsLoading(false);
    if (stored) scheduleRefresh(stored);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoginError(null);
      try {
        const newSession = await adminClient.login(email, password);
        writeSession(newSession);
        setSession(newSession);
        scheduleRefresh(newSession);
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
