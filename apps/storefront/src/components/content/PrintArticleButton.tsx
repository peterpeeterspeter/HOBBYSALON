"use client";

import { Printer } from "lucide-react";

export function PrintArticleButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <Printer size={16} aria-hidden />
      Print instructies
    </button>
  );
}
