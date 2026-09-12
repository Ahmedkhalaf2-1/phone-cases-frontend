"use client";

import Link from "next/link";
import { useState } from "react";
import { VariantPicker } from "@/components/catalog/VariantPicker";
import type { PublicProductDetail } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

/**
 * Owns both the image gallery and the variant picker so the two can stay
 * in sync: clicking a gallery thumbnail changes the shown image, and
 * picking a variant with its own thumbnail overrides it — falling back
 * to the gallery selection when the variant has none (e.g. accessories,
 * or a variant nobody's uploaded a dedicated photo for yet).
 */
export function ProductGallery({
  product,
  source,
}: {
  product: PublicProductDetail | DemoProduct;
  source: "demo" | "live";
}) {
  const sortedMedia = [...product.media].sort((a, b) => a.displayOrder - b.displayOrder);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [variantImage, setVariantImage] = useState<{ url: string; altText: string | null } | null>(
    null,
  );

  const activeImage =
    variantImage ?? sortedMedia[galleryIndex] ?? sortedMedia[0] ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="aspect-square overflow-hidden rounded-sm bg-surface">
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeImage.url}
              alt={activeImage.altText ?? product.name}
              className="h-full w-full object-contain p-4"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {sortedMedia.length > 1 && (
          <div className="mt-3 flex gap-2">
            {sortedMedia.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setVariantImage(null);
                  setGalleryIndex(index);
                }}
                aria-label={`Show image ${index + 1}`}
                aria-current={!variantImage && galleryIndex === index}
                className={`size-16 shrink-0 overflow-hidden rounded-sm border bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  !variantImage && galleryIndex === index ? "border-accent" : "border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-contain p-1"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">
          {product.name}
        </h1>
        {product.description && (
          <p className="mt-3 max-w-md text-muted-foreground">{product.description}</p>
        )}

        {product.collections.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {product.collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/phone-cases?collection=${collection.slug}`}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold tracking-wide text-ink uppercase hover:border-accent hover:text-accent"
              >
                {collection.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <VariantPicker
            variants={product.variants}
            onVariantChange={(variant) => setVariantImage(variant?.thumbnail ?? null)}
          />
        </div>

        {source === "demo" && (
          <p className="mt-6 text-xs text-muted-foreground">
            Demo data — sample product, not real inventory or pricing.
          </p>
        )}
      </div>
    </div>
  );
}
