"use client";

import { removeFromCartAction } from "@/app/actions/cart";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export function RemoveFromCartButton({ itemId }: { itemId: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      await removeFromCartAction(itemId);
    } catch (error) {
      console.error("Failed to remove item:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isLoading}
      className="p-2 text-[var(--muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      title="Verwijder uit winkelwagen"
    >
      <Trash2 size={18} />
    </button>
  );
}
