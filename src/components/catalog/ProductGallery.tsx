"use client";

import Link from "next/link";
import { useState } from "react";
import { PurchaseAssurance } from "@/components/catalog/PurchaseAssurance";
import { VariantPicker } from "@/components/catalog/VariantPicker";
import { SharedProductImage } from "@/components/motion/SharedProductImage";
import type { PublicProductDetail, PublicVariant } from "@/lib/api/types";
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
  bundleNote,
}: {
  product: PublicProductDetail | DemoProduct;
  source: "demo" | "live";
  /** Server-built sentence about an active bundle this product is eligible for. */
  bundleNote?: string;
}) {
  const sortedMedia = [...product.media].sort((a, b) => a.displayOrder - b.displayOrder);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [variantImage, setVariantImage] = useState<{ url: string; altText: string | null } | null>(
    null,
  );

  const activeImage =
    variantImage ?? sortedMedia[galleryIndex] ?? sortedMedia[0] ?? null;

  return (
    <div className="grid gap-10 max-sm:gap-6 lg:grid-cols-2 lg:gap-16">
      <div data-motion="fade">
        {/* Product-page end of the card -> page image morph (see ProductCard). */}
        <SharedProductImage slug={product.slug}>
        <div className="aspect-square overflow-hidden rounded-card bg-surface shadow-card">
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
        </SharedProductImage>

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
                className={`size-16 shrink-0 overflow-hidden rounded-2xl border bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  !variantImage && galleryIndex === index ? "border-accent" : "border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain p-1"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div data-motion="rise">
        <h1 className="font-display text-4xl tracking-tighter text-ink sm:text-5xl">
          {product.name}
        </h1>
        {product.description && (
          <p className="mt-3 max-w-md text-muted-foreground max-sm:mt-2">{product.description}</p>
        )}

        {/* Delivery / quality reassurance sits right under the title. */}
        <PurchaseAssurance className="mt-4 max-sm:mt-3" />

        <div className="mt-6 max-sm:mt-4">
          <VariantPicker
            variants={product.variants}
            bundleNote={bundleNote}
            onVariantChange={(variant) => setVariantImage(variant?.thumbnail ?? null)}
          />
        </div>

        {(product.variants as PublicVariant[]).some((v) => v.isPersonalizable) && (
          <Link
            href={`/customize?product=${product.slug}`}
            className="mt-6 flex items-center justify-between gap-3 rounded-card border border-accent bg-accent-wash px-4 py-3 text-sm text-ink transition-colors hover:bg-accent hover:text-white max-sm:mt-4"
          >
            <span>
              <span className="block font-semibold">Personalize this case</span>
              <span className="opacity-80">Upload your own photo and preview it</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}

        {source === "demo" && (
          <p className="mt-6 text-xs text-muted-foreground">
            Demo data — sample product, not real inventory or pricing.
          </p>
        )}
      </div>
    </div>
  );
}
