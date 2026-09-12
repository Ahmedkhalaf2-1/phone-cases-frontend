"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { adminClient, ApiError } from "@/lib/admin/admin-client";
import { formatPrice } from "@/lib/format-price";
import { LoadingRow } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminProduct } from "@/lib/admin/types";

export default function AdminProductsPage() {
  const { accessToken, authorizedFetch } = useAdminAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    authorizedFetch((token) => adminClient.listProducts(token, { pageSize: 50 }))
      .then((result) => setProducts(result.items))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load products."),
      )
      .finally(() => setIsLoading(false));
  }, [accessToken, authorizedFetch]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-tight text-ink uppercase">
          Products
        </h1>
        <Link
          href="/admin/products/new"
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white uppercase transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          New product
        </Link>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Open a product to manage variants and photos. Collection
        assignment and full field editing aren&apos;t built yet — see
        docs/FRONTEND_PROGRESS.md.
      </p>

      {isLoading && <LoadingRow label="Loading products…" />}
      {error && <p className="mt-6 text-sm text-accent">{error}</p>}

      {!isLoading && !error && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-2 text-start">Name</th>
                <th className="p-2 text-start">Slug</th>
                <th className="p-2 text-start">Status</th>
                <th className="p-2 text-start">Variants</th>
                <th className="p-2 text-start">From</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const lowestPrice = product.variants.length
                  ? Math.min(...product.variants.map((v) => v.price))
                  : null;
                return (
                  <tr key={product.id} className="border-b border-border transition-colors hover:bg-surface">
                    <td className="p-2">{product.nameEn}</td>
                    <td className="p-2 text-muted-foreground">{product.slug}</td>
                    <td className="p-2">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="p-2">{product.variants.length}</td>
                    <td className="p-2">
                      {lowestPrice !== null
                        ? formatPrice(lowestPrice, product.currency)
                        : "—"}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
