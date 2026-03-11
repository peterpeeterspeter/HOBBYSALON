"use client";

import { useMemo, useState } from "react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";

type Variant = {
  id: string;
  title: string;
};

type ProductPurchaseControlsProps = {
  variants: Variant[];
  className?: string;
};

export function ProductPurchaseControls({
  variants,
  className,
}: ProductPurchaseControlsProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null
  );

  const selectedVariantTitle = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId)?.title,
    [selectedVariantId, variants]
  );

  if (!variants.length || !selectedVariantId) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Toevoegen aan winkelwagen binnenkort beschikbaar
      </p>
    );
  }

  return (
    <div className={className}>
      {variants.length > 1 && (
        <div className="mb-4">
          <label
            htmlFor="variant"
            className="mb-1 block text-sm font-medium text-[var(--muted)]"
          >
            Variant
          </label>
          <select
            id="variant"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.title}
              </option>
            ))}
          </select>
          {selectedVariantTitle && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Geselecteerd: {selectedVariantTitle}
            </p>
          )}
        </div>
      )}

      <AddToCartButton variantId={selectedVariantId} className="w-fit" />
    </div>
  );
}
