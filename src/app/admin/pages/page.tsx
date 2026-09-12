"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminPage } from "@/lib/admin/types";

const inputClass =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors enabled:hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AdminPagesPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [pages, setPages] = useState<AdminPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");

  function load() {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listPages(token))
      .then((result) => {
        setPages(result);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load pages."),
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
      await authorizedFetch((token) =>
        adminClient.createPage(token, { slug, titleEn, titleAr, bodyEn, bodyAr }),
      );
      setSlug("");
      setTitleEn("");
      setTitleAr("");
      setBodyEn("");
      setBodyAr("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create page.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleStatus(page: AdminPage) {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await authorizedFetch((token) =>
        adminClient.updatePageStatus(
          token,
          page.id,
          page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
        ),
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update page status.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        Pages
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Published pages appear on the storefront at <code>/pages/&lt;slug&gt;</code>.
      </p>

      {isLoading && <LoadingRow label="Loading pages…" />}
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {!isLoading && (
        <div className="mt-4 flex flex-col gap-3">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-4"
            >
              <div>
                <p className="font-semibold text-ink">{page.titleEn}</p>
                <p className="text-sm text-muted-foreground">/pages/{page.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={page.status} />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleToggleStatus(page)}
                  className="text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {page.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
              </div>
            </div>
          ))}
          {pages.length === 0 && (
            <p className="text-muted-foreground">No pages yet.</p>
          )}
        </div>
      )}

      <h2 className="mt-8 font-semibold text-ink">New page</h2>
      <form onSubmit={handleCreate} className="mt-2 flex max-w-lg flex-col gap-3">
        <input
          required
          placeholder="Slug (kebab-case)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className={inputClass}
        />
        <input
          required
          placeholder="Title (English)"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          className={inputClass}
        />
        <input
          required
          dir="rtl"
          placeholder="العنوان (عربي)"
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          className={inputClass}
        />
        <textarea
          required
          placeholder="Body (English)"
          rows={4}
          value={bodyEn}
          onChange={(e) => setBodyEn(e.target.value)}
          className={inputClass}
        />
        <textarea
          required
          dir="rtl"
          placeholder="النص (عربي)"
          rows={4}
          value={bodyAr}
          onChange={(e) => setBodyAr(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={isBusy} className={`${buttonClass} self-start`}>
          Create as draft
        </button>
      </form>
    </div>
  );
}
