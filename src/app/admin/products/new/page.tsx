"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { inputClass, linkButtonClass } from "@/components/admin/admin-styles";
import { FormSection, MobileActionBar, SummaryCard, SummaryRow } from "@/components/admin/form-kit";
import { formatPrice } from "@/lib/format-price";
import type { AdminCollection } from "@/lib/admin/types";

const textareaClass =
  "w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection: initialCollectionId } = use(searchParams);
  const router = useRouter();
  const { accessToken, authorizedFetch } = useAdminAuth();
  const id = useId();
  const [collections, setCollections] = useState<AdminCollection[]>([]);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [collectionId, setCollectionId] = useState(initialCollectionId ?? "");
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listCollectionsAdmin(token))
      .then(setCollections)
      .catch(() => {});
  }, [accessToken, authorizedFetch]);

  const collection = collections.find((c) => c.id === collectionId) ?? null;
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
      const product = await authorizedFetch((token) =>
        adminClient.createProduct(token, {
          slug,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          descriptionEn: descriptionEn.trim() || undefined,
          descriptionAr: descriptionAr.trim() || undefined,
          basePrice: basePrice ?? undefined,
        }),
      );
      if (collectionId) {
        try {
          await authorizedFetch((token) => adminClient.attachCollectionToProduct(token, product.id, collectionId));
        } catch {
          // The product exists either way; its page shows it isn't in a
          // collection yet and can add it from there.
        }
      }
      // Straight to variants: the next thing a new design needs.
      router.push(
        `/admin/products/${product.id}${initialCollectionId ? `?collection=${initialCollectionId}` : ""}#variants`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create product.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <Link
        href={initialCollectionId ? `/admin/catalog/collections/${initialCollectionId}` : "/admin/products"}
        className={linkButtonClass}
      >
        ← {initialCollectionId && collection ? collection.nameEn : "All products"}
      </Link>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink uppercase">New product</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Start with the basics. Photos, phone models and prices come on the next screen.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 pb-28 lg:pb-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-4">
            <FormSection step={1} title="Name" description="What customers see on the product page and in search.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor={`${id}-en`} className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  English
                  <input
                    id={`${id}-en`}
                    required
                    autoFocus
                    placeholder="e.g. Al Ahly Eagle"
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
                    placeholder="مثال: نسر الأهلي"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className={`${inputClass} font-normal`}
                  />
                </label>
                <label htmlFor={`${id}-slug`} className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
                  Web address
                  <span className="flex items-center gap-1 font-normal">
                    <span className="text-sm text-muted-foreground">/products/</span>
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
                  <span className="text-xs font-normal text-muted-foreground">
                    Filled in from the English name. Lowercase letters, numbers and dashes.
                  </span>
                </label>
              </div>
            </FormSection>

            <FormSection step={2} title="Description" description="Optional. A line or two about the design.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  English
                  <textarea
                    rows={3}
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    className={`${textareaClass} font-normal`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                  عربي
                  <textarea
                    rows={3}
                    dir="rtl"
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    className={`${textareaClass} font-normal`}
                  />
                </label>
              </div>
            </FormSection>

            <FormSection step={3} title="Collection" description="Where customers will find it. You can add more later.">
              <select
                aria-label="Collection"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className={`${inputClass} w-full sm:max-w-sm`}
              >
                <option value="">No collection yet</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                    {c.isActive ? "" : " (hidden)"}
                  </option>
                ))}
              </select>
            </FormSection>

            <FormSection
              step={4}
              title="Starting price"
              description="Optional. Used as the price when you create variants next — you can still change each one."
            >
              <div className="max-w-xs">
                <MoneyInput label="Price" minorUnits={basePrice} onChange={setBasePrice} />
              </div>
            </FormSection>
          </div>

          <SummaryCard
            eyebrow="Preview"
            heading={nameEn.trim() || "New product"}
            error={error}
            hint={hint}
            submitLabel="Create product"
            isSaving={isSubmitting}
            disabled={Boolean(hint)}
            onCancel={() => router.back()}
          >
            <SummaryRow label="Arabic name" value={nameAr.trim() ? <span dir="rtl">{nameAr}</span> : "—"} />
            <SummaryRow label="Web address" value={slug ? `/products/${slug}` : "—"} />
            <SummaryRow label="Collection" value={collection?.nameEn ?? "None yet"} />
            <SummaryRow label="Starting price" value={basePrice !== null ? formatPrice(basePrice, "EGP") : "Set later"} />
            <SummaryRow label="Status" value="Draft (not in the shop yet)" />
          </SummaryCard>
        </div>

        <MobileActionBar
          error={error}
          hint={hint}
          idleText={<span className="text-muted-foreground">Next: photos, phone models and prices.</span>}
          submitLabel="Create product"
          isSaving={isSubmitting}
          disabled={Boolean(hint)}
        />
      </form>
    </div>
  );
}
