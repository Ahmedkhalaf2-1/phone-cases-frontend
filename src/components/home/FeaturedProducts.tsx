import { ProductCard } from "@/components/catalog/ProductCard";
import type { PublicProductSummary } from "@/lib/api/types";
import type { DemoProduct } from "@/lib/demo/products.demo";

export function FeaturedProducts({
  products,
  source,
}: {
  products: (PublicProductSummary | DemoProduct)[];
  source: "demo" | "live";
}) {
  return (
    <section
      aria-labelledby="featured-heading"
      className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8"
    >
      <h2
        id="featured-heading"
        className="mb-6 font-display text-4xl tracking-tighter text-ink sm:text-5xl"
      >
        Caught our eye
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} source={source} />
        ))}
      </div>

      {source === "demo" && (
        <p className="mt-4 text-right text-[10px] font-medium tracking-tight text-muted-foreground uppercase">
          DESIGN CONCEPT — SAMPLE IMAGES & NAMES
        </p>
      )}
    </section>
  );
}
