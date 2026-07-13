"use client";

import { Printer } from "lucide-react";

export function PrintProjectButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <Printer size={18} aria-hidden />
      Print mijn projectoverzicht
    </button>
  );
}
