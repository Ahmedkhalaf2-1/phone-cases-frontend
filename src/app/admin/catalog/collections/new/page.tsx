"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { inputClass, linkButtonClass } from "@/components/admin/admin-styles";
import { FormSection, MobileActionBar, SummaryCard, SummaryRow, ToggleField } from "@/components/admin/form-kit";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewCollectionPage() {
  const router = useRouter();
  const { accessToken, authorizedFetch } = useAdminAuth();
  const id = useId();

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function chooseCover(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  // Release the preview URL when leaving the page.
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const hint = !nameEn.trim()
    ? "Enter the English name."
    : !nameAr.trim()
      ? "Enter the Arabic name."
      : !slugValid
        ? "The web address can only use lowercase letters, numbers and dashes."
        : undefined;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || hint) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await authorizedFetch((token) =>
        adminClient.createCollectionAdmin(token, {
          slug,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          descriptionEn: descriptionEn.trim() || undefined,
          descriptionAr: descriptionAr.trim() || undefined,
          isActive,
        }),
      );
      if (cover) {
        try {
          const asset = await authorizedFetch((token) => adminClient.uploadMedia(token, cover, nameEn.trim()));
          await authorizedFetch((token) =>
            adminClient.updateCollectionAdmin(token, created.id, { coverMediaAssetId: asset.id }),
          );
        } catch {
          // The collection exists; the cover can be added again on its page.
        }
      }
      router.push(`/admin/catalog/collections/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create collection.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <Link href="/admin/catalog/collections" className={linkButtonClass}>
        ← All collections
      </Link>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink uppercase">New collection</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A group of designs customers can browse, like Football or Anime. Add products on the next screen.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 pb-28 lg:pb-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-4">
            <FormSection step={1} title="Name">
              <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor={`${id}-en`} className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  English
                  <input
                    id={`${id}-en`}
                    required
                    autoFocus
                    placeholder="e.g. Football"
                    value={nameEn}
                    onChange={(e) => {
                      setNameEn(e.target.value);
                      if (!slugEdited) setSlug(slugify(e.target.value));
                    }}
                    className={`${inputClass} font-normal`}
                  />
                </label>
                <label htmlFor={`${id}-ar`} className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  عربي
                  <input
                    id={`${id}-ar`}
                    required
                    dir="rtl"
                    placeholder="مثال: كرة القدم"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className={`${inputClass} font-normal`}
                  />
                </label>
                <label htmlFor={`${id}-slug`} className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
                  Web address
                  <span className="flex items-center gap-1 font-normal">
                    <span className="text-sm text-muted-foreground">/collections/</span>
                    <input
                      id={`${id}-slug`}
                      required
                      value={slug}
                      aria-invalid={slug !== "" && !slugValid}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugEdited(true);
                      }}
                      className={`${inputClass} min-w-0 flex-1 sm:max-w-sm`}
                    />
                  </span>
                </label>
              </div>
            </FormSection>

            <FormSection step={2} title="Cover image" description="Optional. Shown on the collection card in the shop. Wide images work best.">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative aspect-[16/10] w-56 overflow-hidden rounded-2xl bg-background">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs font-semibold text-muted-foreground">
                      No cover yet
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-pill border border-border bg-background px-4 py-2 text-center text-sm font-semibold text-ink transition-colors hover:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
                    {cover ? "Choose another" : "Choose image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => chooseCover(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {cover && (
                    <button
                      type="button"
                      onClick={() => chooseCover(null)}
                      className="text-sm font-semibold text-muted-foreground hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection step={3} title="Description" description="Optional.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  English
                  <textarea
                    rows={3}
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    className={`${inputClass} rounded-2xl font-normal`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  عربي
                  <textarea
                    rows={3}
                    dir="rtl"
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    className={`${inputClass} rounded-2xl font-normal`}
                  />
                </label>
              </div>
            </FormSection>

            <FormSection step={4} title="Visibility">
              <ToggleField
                label="Show in the shop"
                help="Turn off to prepare the collection before customers can see it."
                checked={isActive}
                onChange={setIsActive}
              />
            </FormSection>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            {/* Card preview, as in the collections list */}
            <div className="relative hidden aspect-[16/10] overflow-hidden rounded-card bg-surface shadow-card lg:block">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="" className="h-full w-full object-cover object-top" />
              ) : (
                <div className="h-full bg-background" />
              )}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <p className="absolute inset-x-0 bottom-0 truncate p-4 text-lg font-semibold text-white">
                {nameEn.trim() || "Collection name"}
              </p>
            </div>
            <SummaryCard
              eyebrow="New collection"
              heading={nameEn.trim() || "Untitled"}
              error={error}
              hint={hint}
              submitLabel="Create collection"
              isSaving={isSubmitting}
              disabled={Boolean(hint)}
              onCancel={() => router.push("/admin/catalog/collections")}
            >
              <SummaryRow label="Arabic name" value={nameAr.trim() ? <span dir="rtl">{nameAr}</span> : "—"} />
              <SummaryRow label="Web address" value={slug ? `/collections/${slug}` : "—"} />
              <SummaryRow label="Cover" value={cover ? "Added" : "None yet"} />
              <SummaryRow label="In the shop" value={isActive ? "Yes" : "Hidden"} />
            </SummaryCard>
          </div>
        </div>

        <MobileActionBar
          error={error}
          hint={hint}
          idleText={<span className="text-muted-foreground">Next: add products to it.</span>}
          submitLabel="Create collection"
          isSaving={isSubmitting}
          disabled={Boolean(hint)}
        />
      </form>
    </div>
  );
}
