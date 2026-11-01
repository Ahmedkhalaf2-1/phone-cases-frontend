"use client";

import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { Switch } from "@/components/admin/form-kit";
import type { StaffMember, StaffRole } from "@/lib/admin/types";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const inputClass = `w-full rounded-pill border border-border bg-background px-4 py-2 text-sm text-ink ${focusRing}`;
const buttonClass = `rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 ${focusRing}`;
const secondaryButtonClass = `rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink ${focusRing}`;

/** What each role can open, matching the backend's role checks. */
const ROLES: { value: StaffRole; label: string; summary: string; can: string[]; cannot?: string }[] = [
  {
    value: "OWNER_ADMIN",
    label: "Owner",
    summary: "Full access",
    can: ["Everything below", "Staff accounts and the audit log", "Mark orders paid and record refunds"],
  },
  {
    value: "CATALOG_MANAGER",
    label: "Catalog manager",
    summary: "Runs the shop's products",
    can: [
      "Products, collections, brands, phone models, case types",
      "Stock, coupons, bundles and shipping",
      "Homepage and pages",
    ],
    cannot: "Can't see orders",
  },
  {
    value: "ORDER_OPERATOR",
    label: "Order operator",
    summary: "Handles orders",
    can: ["Orders: confirm, prepare, ship, cancel", "Payment receipts, returns and custom designs"],
    cannot: "Can't mark orders paid, refund, or edit products",
  },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label])) as Record<StaffRole, string>;
const ROLE_TONE: Record<StaffRole, string> = {
  OWNER_ADMIN: "bg-ink text-white",
  CATALOG_MANAGER: "bg-blue-100 text-blue-800",
  ORDER_OPERATOR: "bg-amber-100 text-amber-800",
};

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** 12 characters without look-alikes (0/O, 1/l/I), easy to read out. */
function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function AdminStaffPage() {
  const { accessToken, authorizedFetch, staff: currentStaff, updateStaff } = useAdminAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<StaffRole>("ORDER_OPERATOR");
  const [created, setCreated] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const formId = useId();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isOwner = currentStaff?.role === "OWNER_ADMIN";

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listStaff(token))
      .then((result) => {
        setStaff(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load staff."))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    if (password.length < 8) {
      setError("The password needs at least 8 characters.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createStaff(token, { email: email.trim(), fullName: fullName.trim(), password, role }),
      );
      setCreated({ email: email.trim(), password, name: fullName.trim() });
      setCopied(false);
      setEmail("");
      setFullName("");
      setPassword("");
      setShowPassword(false);
      setIsFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the staff account.");
    } finally {
      setIsCreating(false);
    }
  }

  async function update(member: StaffMember, changes: { fullName?: string; role?: StaffRole; isActive?: boolean }) {
    setBusyId(member.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) => adminClient.updateStaff(token, member.id, changes));
      setStaff((prev) => prev.map((m) => (m.id === member.id ? { ...m, ...updated } : m)));
      if (member.id === currentStaff?.id && changes.fullName) updateStaff({ fullName: changes.fullName });
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the staff account.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  if (!isOwner) {
    return (
      <div className="max-w-5xl">
        <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Staff</h1>
        <p className="mt-3 rounded-2xl bg-surface p-4 text-sm text-muted-foreground">Only the owner can manage staff accounts.</p>
      </div>
    );
  }

  // You first, then active people, then by name.
  const sorted = [...staff].sort(
    (a, b) =>
      Number(b.id === currentStaff?.id) - Number(a.id === currentStaff?.id) ||
      Number(b.isActive) - Number(a.isActive) ||
      a.fullName.localeCompare(b.fullName),
  );
  const activeCount = staff.filter((m) => m.isActive).length;

  return (
    <div className="max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? " " : `${activeCount} of ${staff.length} people can sign in`}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isFormOpen}
          aria-controls={formId}
          onClick={() => {
            setIsFormOpen((open) => !open);
            setCreated(null);
          }}
          className={isFormOpen ? secondaryButtonClass : buttonClass}
        >
          {isFormOpen ? "Cancel" : "+ Add staff member"}
        </button>
      </header>

      {created && (
        <div role="status" className="mt-5 rounded-card bg-green-50 p-4 text-sm text-green-900 sm:p-5">
          <p className="font-semibold">{created.name}&apos;s account is ready.</p>
          <p className="mt-1">Send them these sign-in details. This password won&apos;t be shown again.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-white px-3 py-2 font-mono text-sm text-ink">
              {created.email} · {created.password}
            </code>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(`Admin: ${window.location.origin}/admin\nEmail: ${created.email}\nPassword: ${created.password}`)
                  .then(() => setCopied(true))
                  .catch(() => {})
              }
              className={`${secondaryButtonClass} py-1.5`}
            >
              {copied ? "Copied ✓" : "Copy sign-in details"}
            </button>
            <button type="button" onClick={() => setCreated(null)} className="px-2 text-sm font-semibold underline underline-offset-2">
              Done
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <form id={formId} onSubmit={handleCreate} className="mt-5 rounded-card bg-surface p-4 shadow-card sm:p-5">
          <p className="text-sm font-semibold text-ink">New staff member</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
              Full name
              <input
                required
                autoFocus
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`${inputClass} font-normal`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
              Email (used to sign in)
              <input
                required
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputClass} font-normal`}
              />
            </label>
            <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
              <label htmlFor={`${formId}-pw`}>Password (at least 8 characters)</label>
              <div className="flex gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <input
                    id={`${formId}-pw`}
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pe-14 font-normal`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 end-3 text-xs font-semibold text-muted-foreground hover:text-ink"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShowPassword(true);
                  }}
                  className={`${secondaryButtonClass} shrink-0 px-3 py-2 text-xs`}
                >
                  Generate
                </button>
              </div>
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-muted-foreground">Role</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer flex-col rounded-2xl border bg-background p-3 text-sm transition-colors has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink hover:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent border-border`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="size-4 accent-accent"
                    />
                    <span className="font-semibold text-ink">{r.label}</span>
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">{r.can.join(" · ")}</span>
                  {r.cannot && <span className="mt-1 text-xs text-amber-800">{r.cannot}</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={isCreating} className={buttonClass}>
              {isCreating ? "Creating…" : "Create account"}
            </button>
            <span className="text-xs text-muted-foreground">You&apos;ll get the sign-in details to send them.</span>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading ? (
        <div aria-hidden className="mt-5 h-60 animate-pulse rounded-card bg-surface" />
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-card bg-surface shadow-card">
          {sorted.map((member) => {
            const isYou = member.id === currentStaff?.id;
            const busy = busyId === member.id;
            const isEditing = editingId === member.id;
            return (
              <li key={member.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 ${member.isActive ? "" : "opacity-60"}`}>
                <span
                  aria-hidden
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    member.isActive ? "bg-accent text-white" : "bg-background text-muted-foreground"
                  }`}
                >
                  {initials(member.fullName)}
                </span>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (editName.trim().length < 2) return;
                        if (await update(member, { fullName: editName.trim() })) setEditingId(null);
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Full name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                        className={`${inputClass} max-w-xs py-1.5`}
                      />
                      <button type="submit" disabled={busy} className={`${buttonClass} py-1.5`}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={`${secondaryButtonClass} py-1.5`}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-ink">{member.fullName}</span>
                      {isYou && <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-ink">You</span>}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(member.id);
                          setEditName(member.fullName);
                        }}
                        aria-label={`Rename ${member.fullName}`}
                        title="Rename"
                        className={`rounded-lg p-1 text-muted-foreground hover:bg-background hover:text-ink ${focusRing}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5">
                          <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                        </svg>
                      </button>
                    </p>
                  )}
                  <p className="truncate text-sm text-muted-foreground">
                    {member.email}
                    <span className="mx-1.5">·</span>
                    Added {new Date(member.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {isYou ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_TONE[member.role]}`}>
                      {ROLE_LABEL[member.role]}
                    </span>
                  ) : (
                    <select
                      aria-label={`Role for ${member.fullName}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.value as StaffRole;
                        if (next === "OWNER_ADMIN" && !window.confirm(`Give ${member.fullName} full owner access, including staff accounts?`)) {
                          return;
                        }
                        update(member, { role: next });
                      }}
                      className={`rounded-pill border-0 px-3 py-1 text-xs font-semibold ${ROLE_TONE[member.role]} ${focusRing}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <span
                    className="flex w-24 items-center gap-2 text-xs font-semibold text-muted-foreground"
                    title={isYou ? "You can't turn off your own account" : undefined}
                  >
                    <Switch
                      checked={member.isActive}
                      disabled={busy || isYou}
                      onChange={(checked) => {
                        if (!checked && !window.confirm(`Turn off ${member.fullName}'s account? They'll be signed out and can't sign in.`)) {
                          return;
                        }
                        update(member, { isActive: checked });
                      }}
                      label={`${member.fullName} can sign in`}
                    />
                    {member.isActive ? "Can sign in" : "Off"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* What each role can do */}
      <section aria-labelledby="roles-heading" className="mt-6">
        <h2 id="roles-heading" className="text-sm font-semibold text-ink">
          What each role can do
        </h2>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value} className="rounded-card bg-surface p-4 shadow-card">
              <p className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_TONE[r.value]}`}>{r.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {staff.filter((m) => m.role === r.value && m.isActive).length} active
                </span>
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">{r.summary}</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-sm text-muted-foreground">
                {r.can.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="text-green-700">✓</span>
                    {line}
                  </li>
                ))}
                {r.cannot && (
                  <li className="flex gap-2 text-amber-800">
                    <span aria-hidden>✕</span>
                    {r.cannot}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
