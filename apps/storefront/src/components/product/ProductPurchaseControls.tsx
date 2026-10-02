"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { PriceDisplay } from "@/components/domain/price-display";
import { medusaAmountToCents } from "@/lib/commerce/money";

type Variant = {
  id: string;
  title: string;
  calculated_amount?: number;
  currency_code?: string;
};

type ProductPurchaseControlsProps = {
  variants: Variant[];
  productType?: string;
  creatorSlug?: string | null;
  /** Fallback display price (cents) when variants have no per-variant amount. */
  fallbackPrice?: { amount: number; currency_code: string } | null;
  className?: string;
};

export function ProductPurchaseControls({
  variants,
  productType,
  creatorSlug,
  fallbackPrice,
  className,
}: ProductPurchaseControlsProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id ?? null
  );

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants]
  );

  const displayPrice = useMemo(() => {
    if (
      selectedVariant?.calculated_amount != null &&
      Number.isFinite(selectedVariant.calculated_amount)
    ) {
      return {
        amount: medusaAmountToCents(selectedVariant.calculated_amount),
        currency_code: selectedVariant.currency_code ?? "EUR",
      };
    }
    return fallbackPrice ?? null;
  }, [selectedVariant, fallbackPrice]);

  if (!variants.length || !selectedVariantId) {
    const isHandmade = productType === "handmade";

    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--muted)]">
          {isHandmade
            ? "Direct afrekenen is voor dit handgemaakte item nog niet beschikbaar."
            : "Toevoegen aan winkelwagen is voor dit product nog niet beschikbaar."}
        </p>
        {isHandmade && creatorSlug && (
          <Link
            href={`/creator/${creatorSlug}`}
            className="inline-flex rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
          >
            Bekijk makerprofiel
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {displayPrice && (
        <div className="mb-4">
          <PriceDisplay
            amount={displayPrice.amount}
            currencyCode={displayPrice.currency_code}
            size="lg"
          />
        </div>
      )}

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
          {selectedVariant?.title && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Geselecteerd: {selectedVariant.title}
            </p>
          )}
        </div>
      )}

      <AddToCartButton variantId={selectedVariantId} className="w-fit" />
    </div>
  );
}
