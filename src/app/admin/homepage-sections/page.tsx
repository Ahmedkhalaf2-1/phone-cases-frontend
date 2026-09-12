"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminHomepageSection, HomepageSectionType } from "@/lib/admin/types";

const SECTION_TYPES: HomepageSectionType[] = ["BANNER", "PROMO_STRIP"];
const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface SectionFormState {
  type: HomepageSectionType;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  linkUrl: string;
}

const EMPTY_FORM: SectionFormState = {
  type: "BANNER",
  titleEn: "",
  titleAr: "",
  bodyEn: "",
  bodyAr: "",
  linkUrl: "",
};

export default function AdminHomepageSectionsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [sections, setSections] = useState<AdminHomepageSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [createForm, setCreateForm] = useState<SectionFormState>(EMPTY_FORM);
  const [createMediaFile, setCreateMediaFile] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SectionFormState>(EMPTY_FORM);
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listHomepageSections(token))
      .then((result) => {
        setSections(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load sections."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken, authorizedFetch]);

  async function uploadMediaIfAny(file: File | null): Promise<string | undefined> {
    if (!file) return undefined;
    const asset = await authorizedFetch((token) => adminClient.uploadMedia(token, file));
    return asset.id;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      const mediaAssetId = await uploadMediaIfAny(createMediaFile);
      await authorizedFetch((token) =>
        adminClient.createHomepageSection(token, {
          type: createForm.type,
          titleEn: createForm.titleEn || undefined,
          titleAr: createForm.titleAr || undefined,
          bodyEn: createForm.bodyEn || undefined,
          bodyAr: createForm.bodyAr || undefined,
          linkUrl: createForm.linkUrl || undefined,
          mediaAssetId,
        }),
      );
      setCreateForm(EMPTY_FORM);
      setCreateMediaFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create section.");
    } finally {
      setIsBusy(false);
    }
  }

  function startEditing(section: AdminHomepageSection) {
    setEditingId(section.id);
    setEditForm({
      type: section.type,
      titleEn: section.titleEn ?? "",
      titleAr: section.titleAr ?? "",
      bodyEn: section.bodyEn ?? "",
      bodyAr: section.bodyAr ?? "",
      linkUrl: section.linkUrl ?? "",
    });
    setEditMediaFile(null);
  }

  async function handleSaveEdit(event: React.FormEvent, sectionId: string) {
    event.preventDefault();
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      const mediaAssetId = await uploadMediaIfAny(editMediaFile);
      await authorizedFetch((token) =>
        adminClient.updateHomepageSection(token, sectionId, {
          type: editForm.type,
          titleEn: editForm.titleEn || undefined,
          titleAr: editForm.titleAr || undefined,
          bodyEn: editForm.bodyEn || undefined,
          bodyAr: editForm.bodyAr || undefined,
          linkUrl: editForm.linkUrl || undefined,
          ...(mediaAssetId ? { mediaAssetId } : {}),
        }),
      );
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save section.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleEnabled(section: AdminHomepageSection) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) =>
        adminClient.updateHomepageSection(token, section.id, { isEnabled: !section.isEnabled }),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update section.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Homepage sections
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Enabled sections appear on the live homepage: BANNER as a full-width
        image panel between collections and featured products, PROMO_STRIP
        as a thin bar above the header. A section is invisible to customers
        until you enable it here.
      </p>

      {isLoading && <LoadingRow label="Loading sections…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 flex flex-col gap-3">
          {sections.map((section) => (
            <div key={section.id} className="rounded-sm border border-border p-4">
              {editingId === section.id ? (
                <form onSubmit={(e) => handleSaveEdit(e, section.id)} className="flex flex-col gap-3">
                  <SectionFields form={editForm} setForm={setEditForm} onFile={setEditMediaFile} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={isBusy} className={`${buttonClass} self-start`}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-sm font-semibold text-muted-foreground underline underline-offset-4"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {section.titleEn ?? "(untitled)"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {section.type}
                      {section.linkUrl && ` · links to ${section.linkUrl}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEditing(section)}
                      className="text-xs font-semibold text-accent underline underline-offset-4"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleEnabled(section)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 ${
                        section.isEnabled
                          ? "bg-green-100 text-green-800"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {section.isEnabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {sections.length === 0 && (
            <p className="text-muted-foreground">No sections yet.</p>
          )}
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New section</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-col gap-3">
        <SectionFields form={createForm} setForm={setCreateForm} onFile={setCreateMediaFile} />
        <button type="submit" disabled={isBusy} className={`${buttonClass} self-start`}>
          Create (disabled)
        </button>
      </form>
    </div>
  );
}

function SectionFields({
  form,
  setForm,
  onFile,
}: {
  form: SectionFormState;
  setForm: (updater: (prev: SectionFormState) => SectionFormState) => void;
  onFile: (file: File | null) => void;
}) {
  return (
    <>
      <select
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as HomepageSectionType }))}
        className={inputClass}
      >
        {SECTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        placeholder="Title (English)"
        value={form.titleEn}
        onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
        className={inputClass}
      />
      <input
        dir="rtl"
        placeholder="العنوان (عربي)"
        value={form.titleAr}
        onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
        className={inputClass}
      />
      <textarea
        placeholder="Body (English, optional)"
        rows={2}
        value={form.bodyEn}
        onChange={(e) => setForm((f) => ({ ...f, bodyEn: e.target.value }))}
        className={inputClass}
      />
      <textarea
        dir="rtl"
        placeholder="النص (عربي، اختياري)"
        rows={2}
        value={form.bodyAr}
        onChange={(e) => setForm((f) => ({ ...f, bodyAr: e.target.value }))}
        className={inputClass}
      />
      <input
        placeholder="Link (optional, e.g. /phone-cases?collection=summer)"
        value={form.linkUrl}
        onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
        className={inputClass}
      />
      {form.type === "BANNER" && (
        <div>
          <label className="text-sm font-semibold text-ink">Banner image</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="mt-1 block text-sm"
          />
        </div>
      )}
    </>
  );
}
