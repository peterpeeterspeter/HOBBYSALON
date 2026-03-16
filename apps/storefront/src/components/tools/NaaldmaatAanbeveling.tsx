"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Select } from "@/components/ui/select";
import { YARN_WEIGHTS } from "@/lib/tools/yarn-weights";

export function NaaldmaatAanbeveling() {
  const [weightId, setWeightId] = useState("worsted");
  const [type, setType] = useState<"needle" | "hook">("needle");

  const weight = YARN_WEIGHTS.find((w) => w.id === weightId);

  return (
    <CalculatorCard title="Aanbevolen naaldmaat">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Kies je garengewicht en krijg de aanbevolen breinaald- of
          haaknaaldmaat (Craft Yarn Council).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Garengewicht"
            options={YARN_WEIGHTS.map((w) => ({
              value: w.id,
              label: w.nameNl,
            }))}
            value={weightId}
            onChange={(e) => setWeightId(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">
              Type
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setType("needle")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                  type === "needle"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Breinaald
              </button>
              <button
                type="button"
                onClick={() => setType("hook")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                  type === "hook"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Haaknaald
              </button>
            </div>
          </div>
        </div>

        {weight && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4"
            role="status"
          >
            <p className="text-[var(--foreground)]">
              Voor <strong>{weight.nameNl}</strong>: gebruik {type === "needle"
                ? weight.recommendedNeedleMm
                : weight.recommendedHookMm}{" "}
              {type === "needle" ? "breinaald" : "haaknaald"}.
            </p>
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
