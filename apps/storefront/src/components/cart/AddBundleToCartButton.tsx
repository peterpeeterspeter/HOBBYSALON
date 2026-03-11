"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addBundleToCartAction } from "@/app/actions/cart";
import { trackEvent } from "@/lib/analytics/track";

type BundleItem = {
  product_id: string;
  variant_id: string;
  title: string;
  variant_title?: string;
  quantity?: number;
};

type AddBundleToCartButtonProps = {
  bundleId: string;
  bundleLabel: string;
  items: BundleItem[];
  className?: string;
};

export function AddBundleToCartButton({
  bundleId,
  bundleLabel,
  items,
  className = "",
}: AddBundleToCartButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>(
    items.map((item) => item.variant_id)
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedVariantIds.includes(item.variant_id)),
    [items, selectedVariantIds]
  );

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((current) => {
      if (current.includes(variantId)) {
        return current.filter((id) => id !== variantId);
      }
      return [...current, variantId];
    });
  };

  const handleClick = async () => {
    if (selectedItems.length === 0) {
      setMessage("Selecteer minstens 1 item in de bundel");
      return;
    }

    setPending(true);
    setMessage(null);

    const result = await addBundleToCartAction(
      bundleId,
      selectedItems.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity ?? 1,
        product_id: item.product_id,
      })),
      bundleLabel
    );

    setPending(false);

    if (result.success) {
      trackEvent("bundle_add", {
        bundle_id: bundleId,
        bundle_label: bundleLabel,
        item_count: selectedItems.length,
      });
      setMessage("Bundel toegevoegd aan winkelwagen");
      router.refresh();
      router.push("/cart");
      return;
    }

    if (result.added_count && result.added_count > 0) {
      trackEvent("bundle_add", {
        bundle_id: bundleId,
        bundle_label: bundleLabel,
        item_count: result.added_count,
        partial: true,
      });
      setMessage(
        result.message ?? "Een deel van de bundel werd toegevoegd"
      );
      router.refresh();
      router.push("/cart");
      return;
    }

    setMessage(result.message ?? "Bundel toevoegen mislukt");
  };

  if (!items.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Geen bundelitems beschikbaar voor directe aankoop.
      </p>
    );
  }

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 ${className}`}>
      <p className="text-sm font-semibold text-[var(--foreground)]">Projectbundel</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Selecteer de materialen die je meteen wil toevoegen.
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const checked = selectedVariantIds.includes(item.variant_id);
          return (
            <li key={item.variant_id} className="rounded-md border border-[var(--border)] px-3 py-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleVariant(item.variant_id)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    {item.title}
                  </span>
                  {item.variant_title && item.variant_title !== "Default" && (
                    <span className="text-xs text-[var(--muted)]">{item.variant_title}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Toevoegen..." : `Voeg ${selectedItems.length} items toe`}
        </button>
        <Link href="/cart" className="text-sm text-[var(--accent)] underline hover:no-underline">
          Bekijk winkelwagen
        </Link>
      </div>

      {message && (
        <p
          className={
            message.includes("toegevoegd")
              ? "mt-3 text-sm text-green-700"
              : "mt-3 text-sm text-red-700"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
