"use client";

import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { Switch } from "@/components/admin/form-kit";
import type { AdminCaseType, CreateCaseTypeInput } from "@/lib/admin/types";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const inputClass = `rounded-pill border border-border bg-background px-4 py-2 text-sm text-ink ${focusRing}`;
const textareaClass = `rounded-2xl border border-border bg-background px-4 py-2 text-sm text-ink ${focusRing}`;
const buttonClass = `rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors enabled:hover:bg-accent disabled:opacity-50 ${focusRing}`;
const secondaryButtonClass = `rounded-pill border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink ${focusRing}`;
const iconButtonClass = `rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-ink disabled:opacity-30 ${focusRing}`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Draft = { nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string };
const EMPTY_DRAFT: Draft = { nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "" };

export default function AdminCaseTypesPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [caseTypes, setCaseTypes] = useState<AdminCaseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const formId = useId();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY_DRAFT);

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCaseTypesAdmin(token))
      .then((result) => {
        setCaseTypes(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load case types."))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  // Same order the shop uses: displayOrder, then English name.
  const ordered = [...caseTypes].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.nameEn.localeCompare(b.nameEn),
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsCreating(true);
    setError(null);
    try {
      await authorizedFetch((token) =>
        adminClient.createCaseTypeAdmin(token, {
          slug,
          nameEn: draft.nameEn,
          nameAr: draft.nameAr,
          descriptionEn: draft.descriptionEn || undefined,
          descriptionAr: draft.descriptionAr || undefined,
          // New types go to the end of the list.
          displayOrder: ordered.length ? Math.max(...ordered.map((c) => c.displayOrder)) + 1 : 0,
        }),
      );
      setDraft(EMPTY_DRAFT);
      setSlug("");
      setSlugEdited(false);
      setIsFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create case type.");
    } finally {
      setIsCreating(false);
    }
  }

  async function update(caseType: AdminCaseType, changes: Partial<CreateCaseTypeInput>) {
    setBusyId(caseType.id);
    setError(null);
    try {
      const updated = await authorizedFetch((token) =>
        adminClient.updateCaseTypeAdmin(token, caseType.id, changes),
      );
      setCaseTypes((prev) => prev.map((c) => (c.id === caseType.id ? { ...c, ...updated } : c)));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update case type.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  /** Moves a type one place up/down by renumbering the whole list 0..n. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setBusyId(ordered[index].id);
    setError(null);
    try {
      const changed = next
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => c.displayOrder !== i);
      await Promise.all(
        changed.map(({ c, i }) =>
          authorizedFetch((token) => adminClient.updateCaseTypeAdmin(token, c.id, { displayOrder: i })),
        ),
      );
      setCaseTypes(next.map((c, i) => ({ ...c, displayOrder: i })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change the order.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = caseTypes.filter((c) => c.isActive).length;

  return (
    <div className="max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">Case types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? " "
              : `${activeCount} of ${caseTypes.length} shown in the shop · customers see them in this order`}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isFormOpen}
          aria-controls={formId}
          onClick={() => setIsFormOpen((open) => !open)}
          className={isFormOpen ? secondaryButtonClass : buttonClass}
        >
          {isFormOpen ? "Cancel" : "+ New case type"}
        </button>
      </header>

      {isFormOpen && (
        <form
          id={formId}
          onSubmit={handleCreate}
          className="mt-5 grid gap-3 rounded-card bg-surface p-4 shadow-card sm:grid-cols-2 sm:p-5"
        >
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Name (English)
            <input
              required
              autoFocus
              placeholder="e.g. Shock resistant"
              value={draft.nameEn}
              onChange={(e) => {
                setDraft((d) => ({ ...d, nameEn: e.target.value }));
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            الاسم (عربي)
            <input
              required
              dir="rtl"
              placeholder="مثال: مقاوم للصدمات"
              value={draft.nameAr}
              onChange={(e) => setDraft((d) => ({ ...d, nameAr: e.target.value }))}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            Description (English, optional)
            <textarea
              rows={2}
              placeholder="What makes this case different"
              value={draft.descriptionEn}
              onChange={(e) => setDraft((d) => ({ ...d, descriptionEn: e.target.value }))}
              className={`${textareaClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            الوصف (عربي، اختياري)
            <textarea
              rows={2}
              dir="rtl"
              value={draft.descriptionAr}
              onChange={(e) => setDraft((d) => ({ ...d, descriptionAr: e.target.value }))}
              className={`${textareaClass} font-normal`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={isCreating} className={buttonClass}>
              {isCreating ? "Creating…" : "Create case type"}
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              Web address
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Lowercase letters, numbers and dashes"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                className={`${inputClass} w-48 py-1.5 font-normal`}
              />
            </label>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {isLoading ? (
        <div aria-hidden className="mt-6 h-64 animate-pulse rounded-card bg-surface" />
      ) : ordered.length === 0 ? (
        <div className="mt-6 rounded-card bg-surface p-10 text-center shadow-card">
          <p className="font-semibold text-ink">No case types yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add types like Silicone, Shock resistant or Magsafe.</p>
        </div>
      ) : (
        <ol className="mt-6 divide-y divide-border rounded-card bg-surface shadow-card">
          {ordered.map((caseType, index) => {
            const busy = busyId === caseType.id;
            const isEditing = editingId === caseType.id;
            return (
              <li key={caseType.id} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
                {/* Order controls */}
                <div className="flex shrink-0 flex-col items-center">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busyId !== null}
                    aria-label={`Move ${caseType.nameEn} up`}
                    className={iconButtonClass}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
                      <path d="M6 15l6-6 6 6" />
                    </svg>
                  </button>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === ordered.length - 1 || busyId !== null}
                    aria-label={`Move ${caseType.nameEn} down`}
                    className={iconButtonClass}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>

                <span
                  aria-hidden
                  className={`mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                    caseType.isActive ? "bg-ink text-white" : "bg-background text-muted-foreground"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="size-5">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </span>

                {isEditing ? (
                  <form
                    className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await update(caseType, {
                        nameEn: edit.nameEn.trim(),
                        nameAr: edit.nameAr.trim(),
                        descriptionEn: edit.descriptionEn.trim(),
                        descriptionAr: edit.descriptionAr.trim(),
                      });
                      if (ok) setEditingId(null);
                    }}
                  >
                    <input
                      required
                      aria-label="Name (English)"
                      value={edit.nameEn}
                      onChange={(e) => setEdit((d) => ({ ...d, nameEn: e.target.value }))}
                      className={`${inputClass} py-1.5`}
                    />
                    <input
                      required
                      dir="rtl"
                      aria-label="الاسم (عربي)"
                      value={edit.nameAr}
                      onChange={(e) => setEdit((d) => ({ ...d, nameAr: e.target.value }))}
                      className={`${inputClass} py-1.5`}
                    />
                    <textarea
                      rows={2}
                      aria-label="Description (English)"
                      placeholder="Description (English)"
                      value={edit.descriptionEn}
                      onChange={(e) => setEdit((d) => ({ ...d, descriptionEn: e.target.value }))}
                      className={textareaClass}
                    />
                    <textarea
                      rows={2}
                      dir="rtl"
                      aria-label="الوصف (عربي)"
                      placeholder="الوصف (عربي)"
                      value={edit.descriptionAr}
                      onChange={(e) => setEdit((d) => ({ ...d, descriptionAr: e.target.value }))}
                      className={textareaClass}
                    />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" disabled={busy} className={`${buttonClass} py-1.5`}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={`${secondaryButtonClass} py-1.5`}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={`min-w-0 flex-1 ${caseType.isActive ? "" : "opacity-60"}`}>
                      <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-ink">
                        {caseType.nameEn}
                        <span dir="rtl" className="text-sm font-normal text-muted-foreground">
                          {caseType.nameAr}
                        </span>
                      </p>
                      {caseType.descriptionEn || caseType.descriptionAr ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {caseType.descriptionEn || <span dir="rtl">{caseType.descriptionAr}</span>}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground/70">No description</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-start gap-2 pt-1">
                      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Switch
                          checked={caseType.isActive}
                          disabled={busy}
                          onChange={() => update(caseType, { isActive: !caseType.isActive })}
                          label={`${caseType.nameEn} shown in the shop`}
                        />
                        <span className="hidden sm:inline">{caseType.isActive ? "In shop" : "Hidden"}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(caseType.id);
                          setEdit({
                            nameEn: caseType.nameEn,
                            nameAr: caseType.nameAr,
                            descriptionEn: caseType.descriptionEn ?? "",
                            descriptionAr: caseType.descriptionAr ?? "",
                          });
                        }}
                        aria-label={`Edit ${caseType.nameEn}`}
                        title="Edit"
                        className={iconButtonClass}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
                          <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
