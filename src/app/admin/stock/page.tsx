"use client";

import { useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";

export default function AdminStockPage() {
  const { accessToken } = useAdminAuth();
  const formId = useId();
  const [stockItemId, setStockItemId] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setStatus("saving");
    setMessage(null);
    try {
      await adminClient.adjustStock(accessToken, stockItemId, delta, reason);
      setStatus("done");
      setMessage("Stock adjusted.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiError ? err.message : "Could not adjust stock.");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Stock adjustment
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Manual counter adjustment (<code>PATCH /admin/stock-items/:id/adjust</code>).
        You need the stock item&apos;s id — this milestone doesn&apos;t yet
        have a stock item browser, only this direct-adjust form.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-id`} className="text-sm font-semibold text-ink">
            Stock item id
          </label>
          <input
            id={`${formId}-id`}
            required
            value={stockItemId}
            onChange={(e) => setStockItemId(e.target.value)}
            className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-delta`} className="text-sm font-semibold text-ink">
            Delta (+/-)
          </label>
          <input
            id={`${formId}-delta`}
            type="number"
            required
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-reason`} className="text-sm font-semibold text-ink">
            Reason
          </label>
          <input
            id={`${formId}-reason`}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase enabled:hover:bg-accent disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Adjust stock"}
        </button>
        {message && (
          <p className={`text-sm ${status === "error" ? "text-accent" : "text-green-700"}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
