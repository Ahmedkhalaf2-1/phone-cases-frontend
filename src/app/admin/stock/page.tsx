"use client";

import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StockItem, StockMovement, StockReservation } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminStockPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const formId = useId();

  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null);

  const [newSku, setNewSku] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newOnHand, setNewOnHand] = useState("0");
  const [isCreating, setIsCreating] = useState(false);

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listStockItems(token))
      .then((result) => {
        setItems(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load stock items."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  function loadDetail(id: string) {
    if (!accessToken) return;
    setSelectedId(id);
    setIsLoadingDetail(true);
    Promise.all([
      authorizedFetch((token) => adminClient.getStockItemMovements(token, id)),
      authorizedFetch((token) => adminClient.getStockItemReservations(token, id)),
    ])
      .then(([m, r]) => {
        setMovements(m);
        setReservations(r);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load stock item detail."),
      )
      .finally(() => setIsLoadingDetail(false));
  }

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  async function handleAdjust(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !selectedId || isAdjusting) return;
    const deltaNumber = Number(delta);
    if (!Number.isInteger(deltaNumber) || deltaNumber === 0) {
      setAdjustMessage("Enter a non-zero whole-number delta.");
      return;
    }
    if (!reason.trim()) {
      setAdjustMessage("A reason is required.");
      return;
    }
    setIsAdjusting(true);
    setAdjustMessage(null);
    try {
      await authorizedFetch((token) =>
        adminClient.adjustStock(token, selectedId, deltaNumber, reason.trim()),
      );
      setDelta("");
      setReason("");
      setAdjustMessage("Stock adjusted.");
      load();
      loadDetail(selectedId);
    } catch (err) {
      setAdjustMessage(err instanceof ApiError ? err.message : "Could not adjust stock.");
    } finally {
      setIsAdjusting(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createStockItem(token, {
          sku: newSku,
          nameEn: newNameEn,
          onHand: Number(newOnHand) || 0,
        }),
      );
      setNewSku("");
      setNewNameEn("");
      setNewOnHand("0");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create stock item.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">Stock</h1>

      {isLoading && <LoadingRow label="Loading stock items…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="p-2 text-start">SKU</th>
                    <th className="p-2 text-start">Name</th>
                    <th className="p-2 text-end">On hand</th>
                    <th className="p-2 text-end">Reserved</th>
                    <th className="p-2 text-end">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => loadDetail(item.id)}
                      className={`cursor-pointer border-b border-border transition-colors hover:bg-surface ${
                        selectedId === item.id ? "bg-surface" : ""
                      }`}
                    >
                      <td className="p-2 font-mono text-xs">{item.sku}</td>
                      <td className="p-2">{item.nameEn}</td>
                      <td className="p-2 text-end">{item.onHand}</td>
                      <td className="p-2 text-end">{item.reserved}</td>
                      <td className="p-2 text-end font-semibold text-ink">
                        {item.onHand - item.reserved}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No stock items yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="mt-6 font-semibold text-ink">New stock item</h2>
            <form onSubmit={handleCreate} className="mt-2 flex flex-wrap gap-2">
              <input
                required
                placeholder="SKU"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                className={inputClass}
              />
              <input
                required
                placeholder="Name"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                className={inputClass}
              />
              <input
                type="number"
                min={0}
                placeholder="On hand"
                value={newOnHand}
                onChange={(e) => setNewOnHand(e.target.value)}
                className={`${inputClass} w-28`}
              />
              <button type="submit" disabled={isCreating} className={buttonClass}>
                Create
              </button>
            </form>
          </div>

          <div className="rounded-sm border border-border bg-surface p-4">
            {!selectedItem ? (
              <p className="text-sm text-muted-foreground">
                Select a stock item to see its movements, reservations, and adjust it.
              </p>
            ) : (
              <>
                <h2 className="font-semibold text-ink">
                  {selectedItem.nameEn} ({selectedItem.sku})
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  On hand {selectedItem.onHand} · Reserved {selectedItem.reserved} ·
                  Available {selectedItem.onHand - selectedItem.reserved}
                </p>

                <form
                  id={formId}
                  onSubmit={handleAdjust}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${formId}-delta`} className="text-xs font-semibold text-ink">
                      Delta (+/−)
                    </label>
                    <input
                      id={`${formId}-delta`}
                      type="number"
                      required
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                      className={`${inputClass} w-24`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${formId}-reason`} className="text-xs font-semibold text-ink">
                      Reason (required)
                    </label>
                    <input
                      id={`${formId}-reason`}
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <button type="submit" disabled={isAdjusting} className={buttonClass}>
                    {isAdjusting ? "Saving…" : "Adjust"}
                  </button>
                </form>
                {adjustMessage && (
                  <p className="mt-1 text-xs text-ink">{adjustMessage}</p>
                )}

                {isLoadingDetail ? (
                  <LoadingRow label="Loading history…" />
                ) : (
                  <>
                    <h3 className="mt-5 text-sm font-semibold text-ink">Movements</h3>
                    <ul className="mt-1 flex flex-col gap-1 text-xs">
                      {movements.map((m) => (
                        <li key={m.id} className="flex justify-between border-b border-border py-1">
                          <span>
                            {m.reason} {m.referenceType ? `(${m.referenceType})` : ""}
                          </span>
                          <span className={m.delta < 0 ? "text-accent" : "text-green-700"}>
                            {m.delta > 0 ? "+" : ""}
                            {m.delta}
                          </span>
                        </li>
                      ))}
                      {movements.length === 0 && (
                        <li className="text-muted-foreground">No movements yet.</li>
                      )}
                    </ul>

                    <h3 className="mt-5 text-sm font-semibold text-ink">Reservations</h3>
                    <ul className="mt-1 flex flex-col gap-1 text-xs">
                      {reservations.map((r) => (
                        <li key={r.id} className="flex items-center justify-between border-b border-border py-1">
                          <span>Qty {r.quantity}</span>
                          <StatusBadge status={r.status} />
                        </li>
                      ))}
                      {reservations.length === 0 && (
                        <li className="text-muted-foreground">No reservations yet.</li>
                      )}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
