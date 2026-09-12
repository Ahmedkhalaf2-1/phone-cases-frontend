"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { StaffMember, StaffRole } from "@/lib/admin/types";

const ROLES: StaffRole[] = ["OWNER_ADMIN", "CATALOG_MANAGER", "ORDER_OPERATOR"];
const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminStaffPage() {
  const { accessToken, authorizedFetch, staff: currentStaff } = useAdminAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("ORDER_OPERATOR");

  const isOwner = currentStaff?.role === "OWNER_ADMIN";

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listStaff(token))
      .then((result) => {
        setStaff(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load staff."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      await authorizedFetch((token) => adminClient.createStaff(token, { email, fullName, password, role }));
      setEmail("");
      setFullName("");
      setPassword("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create staff account.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleActive(member: StaffMember) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) =>
        adminClient.updateStaff(token, member.id, { isActive: !member.isActive }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update staff account.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!isOwner) {
    return (
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
          Staff
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Only OWNER_ADMIN can manage staff accounts.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Staff
      </h1>

      {isLoading && <LoadingRow label="Loading staff…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">Name</th>
                <th className="p-2 text-start">Email</th>
                <th className="p-2 text-start">Role</th>
                <th className="p-2 text-start">Active</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border transition-colors hover:bg-surface"
                >
                  <td className="p-2">{member.fullName}</td>
                  <td className="p-2 text-muted-foreground">{member.email}</td>
                  <td className="p-2">{member.role}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      disabled={isBusy || member.id === currentStaff?.id}
                      onClick={() => handleToggleActive(member)}
                      title={
                        member.id === currentStaff?.id
                          ? "You can't deactivate your own account"
                          : undefined
                      }
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        member.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New staff account</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="password"
          placeholder="Temporary password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className={inputClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isBusy} className={buttonClass}>
          Create
        </button>
      </form>
    </div>
  );
}
