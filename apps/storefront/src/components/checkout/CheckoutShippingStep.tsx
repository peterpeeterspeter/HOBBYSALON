"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutSelectShipping } from "@/app/actions/checkout";
import type { ShippingOption } from "@/lib/commerce/medusa/cart";

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format((amount ?? 0) / 100);
}

export function CheckoutShippingStep({
  options,
  currencyCode,
  selectedOptionId,
}: {
  options: ShippingOption[];
  currencyCode: string;
  selectedOptionId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSelect = async (optionId: string) => {
    setPending(optionId);
    setMessage(null);
    const result = await checkoutSelectShipping(optionId);
    setPending(null);
    if (result.success) {
      router.refresh();
    } else {
      setMessage(result.message ?? "Er ging iets mis");
    }
  };

  if (!options.length) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
          Verzendmethode
        </h2>
        <p className="text-[var(--muted)]">
          Geen verzendopties beschikbaar. Controleer je adres of neem contact op.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[var(--foreground)]">
        Kies verzendmethode
      </h2>

      <div className="space-y-3">
        {options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          const isLoading = pending === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              disabled={!!pending}
              className={
                "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors " +
                (isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50")
              }
            >
              <span className="font-medium text-[var(--foreground)]">
                {opt.name}
              </span>
              <span className="font-semibold text-[var(--foreground)]">
                {opt.amount != null
                  ? formatPrice(opt.amount, currencyCode)
                  : "Berekenen..."}
              </span>
              {isLoading && (
                <span className="text-sm text-[var(--muted)]">Bezig...</span>
              )}
            </button>
          );
        })}
      </div>

      {message && (
        <p className="text-sm text-red-600">{message}</p>
      )}

      {selectedOptionId && (
        <p className="text-sm text-green-600">
          Verzendmethode gekozen. Klik hieronder om verder te gaan.
        </p>
      )}
    </div>
  );
}
