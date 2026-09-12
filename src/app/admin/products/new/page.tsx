"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { MoneyInput } from "@/components/admin/MoneyInput";

export default function NewProductPage() {
  const router = useRouter();
  const { accessToken } = useAdminAuth();
  const formId = useId();

  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const product = await adminClient.createProduct(accessToken, {
        slug,
        nameEn,
        nameAr,
        descriptionEn: descriptionEn || undefined,
        basePrice: basePrice ?? undefined,
      });
      router.push(`/admin/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create product.");
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
        New product
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 flex max-w-md flex-col gap-4">
        <Field label="Slug (kebab-case)" htmlFor={`${formId}-slug`}>
          <input
            id={`${formId}-slug`}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Name (English)" htmlFor={`${formId}-nameEn`}>
          <input
            id={`${formId}-nameEn`}
            required
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Name (Arabic)" htmlFor={`${formId}-nameAr`}>
          <input
            id={`${formId}-nameAr`}
            required
            dir="rtl"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Description (English, optional)" htmlFor={`${formId}-desc`}>
          <textarea
            id={`${formId}-desc`}
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>
        <MoneyInput
          label="Base price (optional)"
          minorUnits={basePrice}
          onChange={setBasePrice}
        />

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase enabled:hover:bg-accent disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "Create product"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-sm border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
