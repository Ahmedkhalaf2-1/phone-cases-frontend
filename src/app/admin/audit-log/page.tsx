"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AuditLogEntry } from "@/lib/admin/types";

export default function AdminAuditLogPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    authorizedFetch((token) => adminClient.listAuditLog(token, { page, pageSize: 25 }))
      .then((result) => {
        if (cancelled) return;
        setEntries(result.items);
        setTotalPages(result.meta.totalPages);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load the audit log.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, authorizedFetch, page]);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Audit log
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Every recorded staff action, most recent first.
      </p>

      {isLoading && <LoadingRow label="Loading audit log…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && !error && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">When</th>
                <th className="p-2 text-start">Staff</th>
                <th className="p-2 text-start">Action</th>
                <th className="p-2 text-start">Entity</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border transition-colors hover:bg-surface">
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">{entry.staffUser.fullName}</td>
                  <td className="p-2 font-mono text-xs">{entry.action}</td>
                  <td className="p-2 text-muted-foreground">
                    {entry.entityType} · {entry.entityId.slice(0, 8)}…
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No audit entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-2xl border border-border px-3 py-1.5 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-2xl border border-border px-3 py-1.5 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
