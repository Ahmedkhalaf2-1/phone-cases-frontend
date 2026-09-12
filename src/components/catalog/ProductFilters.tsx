"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import type { Collection, PhoneModel, CaseType } from "@/lib/api/types";

export function ProductFilters({
  collections,
  phoneModels,
  caseTypes,
}: {
  collections: Collection[];
  phoneModels: PhoneModel[];
  caseTypes: CaseType[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const formId = useId();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/phone-cases?${params.toString()}`);
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    updateParam("q", query.trim());
  }

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6">
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex gap-2"
      >
        <label htmlFor={`${formId}-q`} className="sr-only">
          Search products
        </label>
        <input
          id={`${formId}-q`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search cases…"
          className="w-full max-w-sm rounded-sm border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Collection"
          value={searchParams.get("collection") ?? ""}
          onChange={(value) => updateParam("collection", value)}
          options={collections.map((c) => ({ value: c.slug, label: c.name }))}
        />
        <FilterSelect
          label="Phone model"
          value={searchParams.get("phoneModel") ?? ""}
          onChange={(value) => updateParam("phoneModel", value)}
          options={phoneModels.map((m) => ({
            value: m.slug,
            label: `${m.brand.name} ${m.name}`,
          }))}
        />
        <FilterSelect
          label="Case type"
          value={searchParams.get("caseType") ?? ""}
          onChange={(value) => updateParam("caseType", value)}
          options={caseTypes.map((c) => ({ value: c.slug, label: c.name }))}
        />
        <FilterSelect
          label="Sort"
          value={searchParams.get("sort") ?? "newest"}
          onChange={(value) => updateParam("sort", value)}
          options={[
            { value: "newest", label: "Newest" },
            { value: "price_asc", label: "Price: low to high" },
            { value: "price_desc", label: "Price: high to low" },
          ]}
          allowEmpty={false}
        />
        <label className="flex items-center gap-2 self-center text-sm text-ink">
          <input
            type="checkbox"
            checked={searchParams.get("availableOnly") === "true"}
            onChange={(event) =>
              updateParam("availableOnly", event.target.checked ? "true" : "")
            }
            className="size-4 rounded-sm border-border accent-accent"
          />
          In stock only
        </label>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allowEmpty = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allowEmpty?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-sm border border-border bg-background px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {allowEmpty && <option value="">{label}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
