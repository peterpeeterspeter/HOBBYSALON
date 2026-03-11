"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction } from "@/app/actions/cart";
import Link from "next/link";

type AddToCartButtonProps = {
  variantId: string;
  quantity?: number;
  className?: string;
};

export function AddToCartButton({
  variantId,
  quantity = 1,
  className = "",
}: AddToCartButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!variantId) {
    return null;
  }

  const handleClick = async () => {
    setPending(true);
    setMessage(null);
    const result = await addToCartAction(variantId, quantity);
    setPending(false);
    if (result.success) {
      setMessage("Toegevoegd aan winkelwagen");
      router.refresh();
      router.push("/cart");
    } else {
      setMessage(result.message ?? "Er ging iets mis");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className={`rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60 ${className}`}
        >
          {pending ? "Bezig..." : "In winkelwagen"}
        </button>
        <Link
          href="/cart"
          className="text-[var(--accent)] underline hover:no-underline"
        >
          Bekijk winkelwagen
        </Link>
      </div>
      {message && (
        <p
          className={
            message.startsWith("Toegevoegd")
              ? "text-sm text-green-600 dark:text-green-400"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
