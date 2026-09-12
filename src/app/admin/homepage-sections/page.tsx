"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import type { AdminHomepageSection } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminHomepageSectionsPage() {
  const { accessToken } = useAdminAuth();
  const [sections, setSections] = useState<AdminHomepageSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");

  function load() {
    if (!accessToken) return;
    adminClient
      .listHomepageSections(accessToken)
      .then((result) => {
        setSections(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load sections."),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [accessToken]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsBusy(true);
    setError(null);
    try {
      await adminClient.createHomepageSection(accessToken, { titleEn, titleAr });
      setTitleEn("");
      setTitleAr("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create section.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleEnabled(section: AdminHomepageSection) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await adminClient.updateHomepageSection(accessToken, section.id, {
        isEnabled: !section.isEnabled,
      });
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
        This backend module exists, but the storefront&apos;s homepage is
        hand-built to match the approved design reference and does{" "}
        <strong>not</strong> read from here yet — see
        docs/FRONTEND_PROGRESS.md. Sections created here are stored but have
        no visible effect on the site until that wiring is done.
      </p>

      {isLoading && <LoadingRow label="Loading sections…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 flex flex-col gap-3">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-4"
            >
              <div>
                <p className="font-semibold text-ink">
                  {section.titleEn ?? "(untitled)"}
                </p>
                <p className="text-sm text-muted-foreground">{section.type}</p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleToggleEnabled(section)}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  section.isEnabled
                    ? "bg-green-100 text-green-800"
                    : "bg-surface text-muted-foreground"
                }`}
              >
                {section.isEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
          {sections.length === 0 && (
            <p className="text-muted-foreground">No sections yet.</p>
          )}
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New section</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-wrap gap-3">
        <input
          placeholder="Title (English)"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          className={inputClass}
        />
        <input
          dir="rtl"
          placeholder="العنوان (عربي)"
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={isBusy} className={buttonClass}>
          Create (BANNER, disabled)
        </button>
      </form>
    </div>
  );
}
