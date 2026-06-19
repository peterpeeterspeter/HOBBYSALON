"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { updateCartLineItemQuantityAction } from "@/app/actions/cart";

type CartItemQuantityControlProps = {
  itemId: string;
  quantity: number;
  disabled?: boolean;
};

const MAX_QUANTITY = 99;

export function CartItemQuantityControl({
  itemId,
  quantity,
  disabled = false,
}: CartItemQuantityControlProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQuantity = async (nextQuantity: number) => {
    if (disabled || isLoading || nextQuantity === quantity) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await updateCartLineItemQuantityAction(
        itemId,
        nextQuantity
      );
      if (!result.success) {
        setError(result.message ?? "Aantal aanpassen mislukt");
        return;
      }
      router.refresh();
    } catch (updateError) {
      console.error("Failed to update quantity:", updateError);
      setError("Aantal aanpassen mislukt");
    } finally {
      setIsLoading(false);
    }
  };

  const canDecrease = quantity > 1 && !disabled && !isLoading;
  const canIncrease = quantity < MAX_QUANTITY && !disabled && !isLoading;

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)]">
        <button
          type="button"
          onClick={() => updateQuantity(quantity - 1)}
          disabled={!canDecrease}
          aria-label="Minder"
          className="p-2 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <span
          className="min-w-8 px-2 text-center text-sm font-medium text-[var(--foreground)]"
          aria-live="polite"
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => updateQuantity(quantity + 1)}
          disabled={!canIncrease}
          aria-label="Meer"
          className="p-2 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
