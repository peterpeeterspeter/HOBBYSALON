"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { PriceDisplay } from "@/components/domain/price-display";
import { medusaAmountToCents } from "@/lib/commerce/money";
import { exactEurVariantPrice, type ExactVariantPriceInput } from "@/lib/commerce/variant-price";

type Variant = {
  id: string;
  title: string;
  calculated_amount?: number;
  currency_code?: string;
  exact_price?: ExactVariantPriceInput | null;
};

type ProductPurchaseControlsProps = {
  variants: Variant[];
  /** Validated URL selection; unmatched IDs keep the legacy first variant. */
  selectedVariantId?: string;
  productType?: string;
  creatorSlug?: string | null;
  /** Fallback display price (cents) when variants have no per-variant amount. */
  fallbackPrice?: { amount: number; currency_code: string } | null;
  className?: string;
};

export function ProductPurchaseControls({
  variants,
  selectedVariantId: initialVariantId,
  productType,
  creatorSlug,
  fallbackPrice,
  className,
}: ProductPurchaseControlsProps) {
  const requestedVariant = typeof initialVariantId === "string" && initialVariantId
    ? variants.find((variant) => variant.id === initialVariantId)
    : undefined;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    requestedVariant?.id ?? variants[0]?.id ?? null
  );

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants]
  );

  const displayPrice = useMemo(() => {
    // Exact-link mode also normalizes subsequent manual selections, always
    // from their raw provenance and never from another variant's fallback.
    if (requestedVariant) return exactEurVariantPrice(selectedVariant?.exact_price);
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
  }, [selectedVariant, fallbackPrice, requestedVariant]);

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
