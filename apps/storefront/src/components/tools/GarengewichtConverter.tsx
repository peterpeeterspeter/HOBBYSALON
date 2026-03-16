"use client";

import { useState } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { YARN_WEIGHTS } from "@/lib/tools/yarn-weights";

export function GarengewichtConverter() {
  const [mode, setMode] = useState<"grams" | "meters">("grams");
  const [value, setValue] = useState("");
  const [weightId, setWeightId] = useState("worsted");

  const num = parseFloat(value.replace(",", ".")) || 0;
  const weight = YARN_WEIGHTS.find((w) => w.id === weightId);
  const avgMpg = weight
    ? (weight.minMetersPer100g + weight.maxMetersPer100g) / 2
    : 0;

  let result = "";
  if (num > 0 && weight) {
    if (mode === "grams") {
      const meters = (num / 100) * avgMpg;
      result = `${num}g komt overeen met ca. ${meters.toFixed(0)} meter (bij ${weight.nameNl}, gem. ${avgMpg.toFixed(0)} m/100g).`;
    } else {
      const grams = (num / avgMpg) * 100;
      result = `${num} meter komt overeen met ca. ${grams.toFixed(0)}g (bij ${weight.nameNl}).`;
    }
  }

  return (
    <CalculatorCard title="Omrekenen gram ↔ meter">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Reken om tussen gram en meter op basis van garengewichtscategorie.
        </p>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode("grams")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "grams"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Gram → meter
          </button>
          <button
            type="button"
            onClick={() => setMode("meters")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "meters"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Meter → gram
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="decimal"
            label={mode === "grams" ? "Gewicht (gram)" : "Lengte (meter)"}
            placeholder={mode === "grams" ? "bijv. 100" : "bijv. 200"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Select
            label="Garengewicht"
            options={YARN_WEIGHTS.map((w) => ({
              value: w.id,
              label: w.nameNl,
            }))}
            value={weightId}
            onChange={(e) => setWeightId(e.target.value)}
          />
        </div>

        {result && (
          <div
            className="rounded-lg bg-[var(--section-alt)] p-4 text-[var(--foreground)]"
            role="status"
          >
            {result}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
