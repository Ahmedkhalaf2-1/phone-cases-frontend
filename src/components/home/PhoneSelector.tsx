"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { useId, useMemo, useState } from "react";
import type { PhoneModel } from "@/lib/api/types";

export function PhoneSelector({
  models,
  source,
}: {
  models: PhoneModel[];
  source: "demo" | "live";
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(models[0]?.id ?? "");
  const selectId = useId();
  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId),
    [models, selectedId],
  );

  return (
    <section
      aria-label={t("home.findPhone")}
      className="relative z-10 mx-auto -mt-6 max-w-[1440px] px-4 sm:-mt-10 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface px-5 py-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <label
            htmlFor={selectId}
            className="text-sm font-medium tracking-tight text-ink"
          >
            {t("home.findPhone")}
          </label>
          <div className="relative w-full sm:w-64">
            <select
              id={selectId}
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full appearance-none rounded-pill border border-border bg-background py-2.5 ps-4 pe-9 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.brand.name} {model.name}
                </option>
              ))}
            </select>
            <ChevronIcon className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <a
          href={
            selectedModel
              ? `/search?phoneModel=${selectedModel.slug}`
              : "/collections"
          }
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-ink underline underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:self-auto"
        >
          {t("home.changeModel")} <span aria-hidden className="rtl:-scale-x-100">→</span>
        </a>
      </div>
      {source === "demo" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("home.demoModels")}
        </p>
      )}
    </section>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
